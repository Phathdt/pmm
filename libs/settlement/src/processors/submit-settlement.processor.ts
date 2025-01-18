import { AxiosError } from 'axios'
import { Job } from 'bull'
import { ethers } from 'ethers'

import { ensureHexPrefix, toObject } from '@bitfi-mock-pmm/shared'
import {
  getMakePaymentHash,
  getSignature,
  routerService,
  SignatureType,
  signerService,
  solverService,
} from '@bitfixyz/market-maker-sdk'
import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SETTLEMENT_QUEUE } from '../const'
import { SubmitSettlementEvent } from '../types'

function generatePaymentTxIds(initialTxId: string): string[] {
  const paymentTxIds: string[] = [initialTxId]

  // Generate 99 more transaction IDs
  for (let i = 0; i < 99; i++) {
    // Create a random bytes32 value
    const randomBytes = ethers.randomBytes(32)
    const txId = '0x' + Buffer.from(randomBytes).toString('hex')
    paymentTxIds.push(txId)
  }

  return paymentTxIds
}

@Processor(SETTLEMENT_QUEUE.SUBMIT.NAME)
export class SubmitSettlementProcessor {
  private provider: ethers.JsonRpcProvider
  private pmmWallet: ethers.Wallet
  private pmmPrivateKey: string
  private pmmId: string

  private solverSerivce = solverService
  private routerService = routerService

  private readonly logger = new Logger(SubmitSettlementProcessor.name)

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL')
    this.pmmPrivateKey = this.configService.getOrThrow<string>('PMM_PRIVATE_KEY')

    this.pmmId = this.configService.getOrThrow<string>('PMM_ID')

    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    this.pmmWallet = new ethers.Wallet(this.pmmPrivateKey, this.provider)
  }

  private async processPayment(
    tradeId: string,
    paymentTxId: string,
    signerAddress: string,
    signedAt: number,
    startIdx: bigint
  ) {
    const tradeIds: string[] = [tradeId]
    const makePaymentInfoHash = getMakePaymentHash(tradeIds, BigInt(signedAt), startIdx, ensureHexPrefix(paymentTxId))

    const domain = await signerService.getDomain()

    const signature = await getSignature(
      this.pmmWallet,
      this.provider,
      signerAddress,
      tradeId,
      makePaymentInfoHash,
      SignatureType.MakePayment,
      domain
    )
    this.logger.log(`Generated signature: ${signature}`)

    const requestPayload = {
      tradeIds: [tradeId],
      pmmId: this.pmmId,
      settlementTx: ensureHexPrefix(paymentTxId),
      signature: signature,
      startIndex: 0,
      signedAt: signedAt,
    }

    this.logger.log(`Sending request to solver with payload: ${JSON.stringify(requestPayload)}`)

    try {
      const response = await this.solverSerivce.submitSettlementTx(requestPayload)

      this.logger.log(`Solver response for trade ${tradeId}:`)
      this.logger.log(`Response data: ${JSON.stringify(response)}`)
      this.logger.log(`Submit settlement for trade ${tradeId} completed successfully`)
    } catch (axiosError) {
      if (axiosError instanceof AxiosError) {
        this.logger.error(`API Request failed for trade ${tradeId}:`)
        this.logger.error(`Status: ${axiosError.response?.status}`)
        this.logger.error(`Error message: ${axiosError.message}`)
        this.logger.error(`Response data: ${JSON.stringify(axiosError.response?.data)}`)
        this.logger.error(
          `Request config: ${JSON.stringify({
            method: axiosError.config?.method,
            url: axiosError.config?.url,
            headers: axiosError.config?.headers,
            data: axiosError.config?.data,
          })}`
        )
      }
      throw axiosError
    }
  }

  @Process(SETTLEMENT_QUEUE.SUBMIT.JOBS.PROCESS)
  async submit(job: Job<string>) {
    const { tradeId, paymentTxId } = toObject(job.data) as SubmitSettlementEvent

    this.logger.log(`Starting settlement submission for Trade ID: ${tradeId}`)
    this.logger.log(`Payment Transaction ID: ${paymentTxId}`)

    const paymentTxIds = generatePaymentTxIds(paymentTxId)

    try {
      const startIdx = BigInt(0)
      const signerAddress = await this.routerService.getSigner()
      const signedAt = Math.floor(Date.now() / 1000)

      for (const currentPaymentTxId of paymentTxIds) {
        await this.processPayment(tradeId, currentPaymentTxId, signerAddress, signedAt, startIdx)
      }
    } catch (error: any) {
      this.logger.error('submit settlement error', error.stack)
      throw error
    }
  }
}
