import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { optimexSolProgram, PmmInfoResponseDto } from '@optimex-pmm/settlement'
import { stringToHex } from '@optimex-pmm/shared'
import { AssetChainContractRole, config, OptimexEvmNetwork, protocolService } from '@optimex-xyz/market-maker-sdk'
import { Keypair } from '@solana/web3.js'

import * as bitcoin from 'bitcoinjs-lib'
import bs58 from 'bs58'
import { ECPairFactory } from 'ecpair'
import * as ethers from 'ethers'
import * as ecc from 'tiny-secp256k1'

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name)
  private readonly pmmId: string
  private readonly pmmEncodeId: string
  private readonly operatorAddress: string
  private readonly evmReceiverAddress: string
  private readonly btcReceiverAddress: string
  private readonly solanaReceiverAddress: string
  private readonly evmSenderAddress: string
  private readonly btcSenderAddress: string
  private readonly solanaSenderAddress: string

  constructor(private readonly configService: ConfigService) {
    // Initialize ECC library for Bitcoin
    bitcoin.initEccLib(ecc)

    // Initialize PMM identifiers
    this.pmmId = this.configService.getOrThrow<string>('PMM_ID')
    this.pmmEncodeId = stringToHex(this.pmmId)

    // Derive operator address from PMM private key
    this.operatorAddress = this.deriveOperatorAddress()

    // Load configured receiver addresses
    this.evmReceiverAddress = this.configService.getOrThrow<string>('PMM_EVM_ADDRESS')
    this.btcReceiverAddress = this.configService.getOrThrow<string>('PMM_BTC_ADDRESS')
    this.solanaReceiverAddress = this.configService.getOrThrow<string>('PMM_SOLANA_ADDRESS')

    // Derive sender addresses from private keys
    this.evmSenderAddress = this.deriveEvmSenderAddress()
    this.btcSenderAddress = this.deriveBtcSenderAddress()
    this.solanaSenderAddress = this.deriveSolanaSenderAddress()
  }

  async getPmmInfo(): Promise<PmmInfoResponseDto> {
    // Get contract addresses for current network only (testnet or mainnet)
    const networkId = config.isTestnet() ? OptimexEvmNetwork.EthereumSepolia : OptimexEvmNetwork.EthereumMainnet

    let routerAddress = ''
    let evmContract = {
      payment: '',
      liquidation: '',
    }

    try {
      // Get router address
      routerAddress = await protocolService.getRouter()

      // Get payment and liquidation contract addresses
      const paymentAddress = await protocolService.getAssetChainConfig(networkId, AssetChainContractRole.Payment)
      const liquidationAddress = await protocolService.getAssetChainConfig(
        networkId,
        AssetChainContractRole.MorphoLiquidationGateway
      )

      evmContract = {
        payment: paymentAddress?.[0] || '',
        liquidation: liquidationAddress?.[0] || '',
      }
    } catch (error) {
      this.logger.warn(`Failed to get contract addresses for network ${networkId}: ${(error as Error).message}`)
    }

    return {
      pmmId: this.pmmId,
      pmmEncodeId: this.pmmEncodeId,
      operatorAddress: this.operatorAddress,
      evmReceiverAddress: this.evmReceiverAddress,
      btcReceiverAddress: this.btcReceiverAddress,
      solanaReceiverAddress: this.solanaReceiverAddress,
      evmSenderAddress: this.evmSenderAddress,
      btcSenderAddress: this.btcSenderAddress,
      solanaSenderAddress: this.solanaSenderAddress,
      contracts: {
        router: routerAddress,
        evm: {
          [networkId]: evmContract,
        },
        solana: {
          programId: optimexSolProgram.programId.toBase58(),
        },
      },
    }
  }

  private deriveOperatorAddress(): string {
    const pmmPrivateKey = this.configService.getOrThrow<string>('PMM_PRIVATE_KEY')
    const wallet = new ethers.Wallet(pmmPrivateKey)
    return wallet.address
  }

  private deriveEvmSenderAddress(): string {
    const evmPrivateKey = this.configService.getOrThrow<string>('PMM_EVM_PRIVATE_KEY')
    const evmWallet = new ethers.Wallet(evmPrivateKey)
    return evmWallet.address
  }

  private deriveBtcSenderAddress(): string {
    const ECPair = ECPairFactory(ecc)
    const btcPrivateKey = this.configService.getOrThrow<string>('PMM_BTC_PRIVATE_KEY')
    const btcNetwork = config.isTestnet() ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

    let btcKeyPair: ReturnType<typeof ECPair.fromPrivateKey>

    try {
      // Try to decode with current network first
      btcKeyPair = ECPair.fromWIF(btcPrivateKey, btcNetwork)
      this.logger.log('WIF matches current network')
    } catch (error) {
      // If failed, try to decode with opposite network
      const oppositeNetwork = config.isTestnet() ? bitcoin.networks.bitcoin : bitcoin.networks.testnet

      try {
        const tempKeyPair = ECPair.fromWIF(btcPrivateKey, oppositeNetwork)
        // Decode successful → convert to correct network
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        btcKeyPair = ECPair.fromPrivateKey(tempKeyPair.privateKey!, { network: btcNetwork })
        this.logger.warn(
          `WIF is for ${config.isTestnet() ? 'mainnet' : 'testnet'}, converted to ${config.isTestnet() ? 'testnet' : 'mainnet'}`
        )
      } catch {
        throw new Error(`Invalid BTC private key format: ${(error as Error).message}`)
      }
    }

    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(btcKeyPair.publicKey.slice(1, 33)),
      network: btcNetwork,
    })
    this.logger.log(`BTC sender address derived: ${p2tr.address}`)
    return p2tr.address || ''
  }

  private deriveSolanaSenderAddress(): string {
    const solanaPrivateKey = this.configService.getOrThrow<string>('PMM_SOLANA_PRIVATE_KEY')
    const solanaPrivateKeyBytes = bs58.decode(solanaPrivateKey)
    const solanaKeypair = Keypair.fromSecretKey(solanaPrivateKeyBytes)
    return solanaKeypair.publicKey.toBase58()
  }
}
