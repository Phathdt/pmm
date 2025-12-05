import { Injectable, Logger } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { config } from '@optimex-xyz/market-maker-sdk'

import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import * as ecc from 'tiny-secp256k1'

import {
  FeeEstimates,
  FeeEstimatesSchema,
  IBitcoinService,
  SendBtcParams,
  SendBtcResult,
  TransactionResponse,
  TransactionResponseSchema,
  Utxo,
  UtxoSchema,
} from '../../domain'
import { BlockstreamProvider, MempoolProvider } from '../../infras'
import { deriveP2TRAddress } from '../../utils'

// Fee calculation constants
const DEFAULT_FALLBACK_FEE_RATE = 5 // sat/vB fallback when no estimates available
const FEE_BUFFER_MULTIPLIER = 1.125 // 12.5% buffer for fee safety margin
const DUST_THRESHOLD = 546n // Minimum output value in satoshis

@Injectable()
export class BitcoinService implements IBitcoinService {
  private readonly logger = new Logger(BitcoinService.name)
  private readonly maxRetries: number
  private readonly retryDelay: number
  private readonly privateKey: string
  private readonly btcAddress: string
  private readonly maxFeeRate: number
  private readonly skipConfirm: boolean
  private readonly ECPair = ECPairFactory(ecc)

  constructor(
    private readonly blockstream: BlockstreamProvider,
    private readonly mempool: MempoolProvider,
    private readonly configService: CustomConfigService
  ) {
    this.maxRetries = this.configService.bitcoin.maxRetries
    this.retryDelay = this.configService.bitcoin.retryDelayMs
    this.privateKey = this.configService.pmm.btc.privateKey
    this.btcAddress = deriveP2TRAddress({ privateKeyWIF: this.privateKey }).address
    this.maxFeeRate = this.configService.pmm.btc.maxFeeRate
    this.skipConfirm = this.configService.bitcoin.skipConfirm ?? false
    bitcoin.initEccLib(ecc)
  }

  /**
   * Race multiple providers using Promise.any() with retry logic.
   * First successful response wins. Handles AggregateError for detailed logging.
   */
  private async raceProviders<T>(
    operation: string,
    blockstreamFn: () => Promise<T>,
    mempoolFn: () => Promise<T>
  ): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await Promise.any([mempoolFn(), blockstreamFn()])
      } catch (error) {
        // Handle AggregateError from Promise.any to log individual provider failures
        if (error instanceof AggregateError) {
          const providerErrors = error.errors.map((e, i) => ({
            provider: i === 0 ? 'mempool' : 'blockstream',
            error: e instanceof Error ? e.message : String(e),
          }))
          this.logger.warn({
            message: `${operation} failed on attempt ${attempt}/${this.maxRetries}`,
            providerErrors,
            attempt,
            maxRetries: this.maxRetries,
          })
        } else {
          this.logger.warn({
            message: `${operation} failed on attempt ${attempt}/${this.maxRetries}`,
            error: error instanceof Error ? error.message : String(error),
            attempt,
            maxRetries: this.maxRetries,
          })
        }

        if (attempt === this.maxRetries) {
          throw new Error(`${operation} failed after ${this.maxRetries} attempts`)
        }
        await new Promise((r) => setTimeout(r, this.retryDelay))
      }
    }
    throw new Error(`${operation} failed unexpectedly`)
  }

  async broadcast(txHex: string): Promise<string> {
    return this.raceProviders(
      'broadcast',
      () => this.blockstream.broadcast(txHex),
      () => this.mempool.broadcast(txHex)
    )
  }

  async getTransaction(txId: string): Promise<TransactionResponse | null> {
    try {
      const response = await this.raceProviders(
        'getTransaction',
        () => this.blockstream.getTransaction(txId),
        () => this.mempool.getTransaction(txId)
      )
      // Validate response against schema
      const parsed = TransactionResponseSchema.safeParse(response)
      if (!parsed.success) {
        this.logger.warn({
          message: 'Transaction response validation failed',
          txId,
          issues: parsed.error.issues,
        })
        return response // Return raw response if validation fails (backward compatible)
      }
      return parsed.data
    } catch (error) {
      this.logger.warn({
        message: 'Failed to get transaction from all providers',
        txId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async getUtxos(address: string): Promise<Utxo[]> {
    const response = await this.raceProviders(
      'getUtxos',
      () => this.blockstream.getUtxos(address),
      () => this.mempool.getUtxos(address)
    )
    // Validate each UTXO against schema
    let utxos = response.map((utxo) => {
      const parsed = UtxoSchema.safeParse(utxo)
      if (!parsed.success) {
        this.logger.warn({
          message: 'UTXO validation failed',
          address,
          utxo,
          issues: parsed.error.issues,
        })
        return utxo // Return raw UTXO if validation fails (backward compatible)
      }
      return parsed.data
    })

    // Filter out unconfirmed UTXOs unless skipConfirm is enabled
    if (!this.skipConfirm) {
      const totalUtxos = utxos.length
      utxos = utxos.filter((utxo) => utxo.status?.confirmed === true)
      const filteredCount = totalUtxos - utxos.length
      if (filteredCount > 0) {
        this.logger.debug({
          message: 'Filtered unconfirmed UTXOs',
          address,
          totalUtxos,
          confirmedUtxos: utxos.length,
          filteredCount,
          operation: 'require_confirmed_utxos',
        })
      }
    }

    return utxos
  }

  async getBalance(address: string): Promise<bigint> {
    const utxos = await this.getUtxos(address)
    return utxos.reduce((sum, utxo) => sum + BigInt(utxo.value), 0n)
  }

  async getFeeEstimates(): Promise<FeeEstimates> {
    const response = await this.raceProviders(
      'getFeeEstimates',
      () => this.blockstream.getFeeEstimates(),
      () => this.mempool.getFeeEstimates()
    )
    // Validate response against schema
    const parsed = FeeEstimatesSchema.safeParse(response)
    if (!parsed.success) {
      this.logger.warn({
        message: 'Fee estimates validation failed',
        issues: parsed.error.issues,
      })
      return response // Return raw response if validation fails (backward compatible)
    }
    return parsed.data
  }

  async getRecommendedFeeRate(): Promise<number> {
    const estimates = await this.getFeeEstimates()
    const targets = Object.keys(estimates)
      .map(Number)
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b)

    if (targets.length === 0) {
      this.logger.warn({
        message: 'No fee estimates available, using fallback',
        fallbackFeeRate: DEFAULT_FALLBACK_FEE_RATE,
      })
      return DEFAULT_FALLBACK_FEE_RATE
    }

    // Use fastest confirmation target with safety buffer
    return estimates[targets[0]] * FEE_BUFFER_MULTIPLIER
  }

  /**
   * Send BTC from PMM wallet to a recipient address.
   * Uses P2TR (Taproot) for signing and supports optional OP_RETURN data.
   */
  async sendBtc(params: SendBtcParams): Promise<SendBtcResult> {
    const { toAddress, amount, opReturnData } = params

    const isTestnet = config.isTestnet()
    const network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

    this.logger.log({
      message: 'Starting BTC transfer',
      fromAddress: this.btcAddress,
      toAddress,
      amount: amount.toString(),
      hasOpReturn: !!opReturnData,
      network: isTestnet ? 'testnet' : 'mainnet',
    })

    // Get UTXOs from sender address
    const utxos = await this.getUtxos(this.btcAddress)
    if (utxos.length === 0) {
      throw new Error('No UTXOs found in BTC wallet')
    }

    // Create key pair and payment
    const keyPair = this.ECPair.fromWIF(this.privateKey, network)
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(keyPair.publicKey.slice(1, 33)),
      network,
    })

    if (!p2tr.address || !p2tr.output) {
      throw new Error('Could not generate P2TR address/output')
    }

    // Build PSBT
    const psbt = new bitcoin.Psbt({ network })
    let totalInput = 0n
    const internalKey = Buffer.from(keyPair.publicKey.slice(1, 33))

    for (const utxo of utxos) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: p2tr.output,
          value: BigInt(utxo.value),
        },
        tapInternalKey: internalKey,
      })
      totalInput += BigInt(utxo.value)
    }

    // Calculate fee
    const feeRate = await this.getRecommendedFeeRate()
    const cappedFeeRate = Math.min(feeRate, this.maxFeeRate)
    const outputCount = opReturnData ? 3 : 2 // recipient + change + optional OP_RETURN
    const txSize = this.calculateTxSize(utxos.length, outputCount, !!opReturnData)
    const feeSats = BigInt(Math.ceil(txSize * cappedFeeRate))
    const changeAmount = totalInput - amount - feeSats

    this.logger.log({
      message: 'BTC transaction calculated',
      totalInput: totalInput.toString(),
      amount: amount.toString(),
      feeSats: feeSats.toString(),
      changeAmount: changeAmount.toString(),
      feeRate: cappedFeeRate,
      txSize,
    })

    // Validate sufficient balance
    if (totalInput < amount + feeSats) {
      throw new Error(`Insufficient balance. Need ${amount + feeSats} sats, but only have ${totalInput} sats`)
    }

    // Add recipient output
    psbt.addOutput({
      address: toAddress,
      value: amount,
    })

    // Add change output if above dust threshold
    if (changeAmount > DUST_THRESHOLD) {
      psbt.addOutput({
        address: this.btcAddress,
        value: changeAmount,
      })
    }

    // Add OP_RETURN output if provided
    if (opReturnData) {
      const dataBuffer = Buffer.from(opReturnData, 'hex')
      psbt.addOutput({
        script: bitcoin.script.compile([bitcoin.opcodes['OP_RETURN'], dataBuffer]),
        value: 0n,
      })
    }

    // Sign all inputs with tweaked key
    const toXOnly = (pubKey: Uint8Array) => (pubKey.length === 32 ? pubKey : pubKey.slice(1, 33))
    const tweakedSigner = keyPair.tweak(bitcoin.crypto.taggedHash('TapTweak', toXOnly(keyPair.publicKey)))

    for (let i = 0; i < psbt.data.inputs.length; i++) {
      psbt.signInput(i, tweakedSigner, [bitcoin.Transaction.SIGHASH_DEFAULT])
    }

    psbt.finalizeAllInputs()

    // Extract and broadcast
    const tx = psbt.extractTransaction()
    const rawTx = tx.toHex()
    const txId = await this.broadcast(rawTx)

    this.logger.log({
      message: 'BTC transfer completed',
      txId,
      toAddress,
      amount: amount.toString(),
      feeSats: feeSats.toString(),
    })

    return { txId, feeSats }
  }

  /**
   * Calculate transaction size for fee estimation.
   * @param inputCount - Number of inputs
   * @param outputCount - Number of outputs (excluding OP_RETURN)
   * @param hasOpReturn - Whether transaction includes OP_RETURN
   */
  private calculateTxSize(inputCount: number, outputCount: number, hasOpReturn: boolean): number {
    const baseTxSize = 10 // version, locktime, etc.
    const inputSize = 107 // outpoint (41) + sequence (1) + witness (65)
    const p2trOutputSize = 42 // value (8) + script (34)
    const opReturnOutputSize = hasOpReturn ? 41 : 0 // value (8) + OP_RETURN script

    return baseTxSize + inputSize * inputCount + p2trOutputSize * outputCount + opReturnOutputSize
  }
}
