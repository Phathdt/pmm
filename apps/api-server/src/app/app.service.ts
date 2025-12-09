import { Injectable, Logger } from '@nestjs/common'
import { deriveP2TRAddress } from '@optimex-pmm/bitcoin'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { optimexSolProgram, PmmInfoResponseDto } from '@optimex-pmm/settlement'
import { stringToHex } from '@optimex-pmm/shared'
import { AssetChainContractRole, config, OptimexEvmNetwork, protocolService } from '@optimex-xyz/market-maker-sdk'
import { Keypair } from '@solana/web3.js'

import bs58 from 'bs58'
import * as ethers from 'ethers'

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

  constructor(private readonly configService: CustomConfigService) {
    // Initialize PMM identifiers
    this.pmmId = this.configService.pmm.id
    this.pmmEncodeId = stringToHex(this.pmmId)

    // Derive operator address from PMM private key
    this.operatorAddress = this.deriveOperatorAddress()

    // Load configured receiver addresses
    this.evmReceiverAddress = this.configService.pmm.evm.address
    this.solanaReceiverAddress = this.configService.pmm.solana.address

    // Derive sender addresses from private keys
    this.evmSenderAddress = this.deriveEvmSenderAddress()
    this.solanaSenderAddress = this.deriveSolanaSenderAddress()

    // Derive BTC addresses from private key (same wallet for sender and receiver)
    const btcAddress = this.deriveBtcAddress()
    this.btcSenderAddress = btcAddress
    this.btcReceiverAddress = btcAddress
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

    // Derive liquidation approver addresses from private keys
    const liquidationApprovers = this.deriveLiquidationApprovers()

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
      liquidationApprovers,
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
    const pmmPrivateKey = this.configService.pmm.privateKey
    const wallet = new ethers.Wallet(pmmPrivateKey)
    return wallet.address
  }

  private deriveEvmSenderAddress(): string {
    const evmPrivateKey = this.configService.pmm.evm.privateKey
    const evmWallet = new ethers.Wallet(evmPrivateKey)
    return evmWallet.address
  }

  private deriveBtcAddress(): string {
    const btcPrivateKey = this.configService.pmm.btc.privateKey

    const result = deriveP2TRAddress({
      privateKeyWIF: btcPrivateKey,
    })

    if (result.wasConverted) {
      this.logger.warn(`WIF is for ${result.originalNetwork}, converted`)
    } else {
      this.logger.log('WIF matches current network')
    }

    this.logger.log(`BTC address derived: ${result.address}`)
    return result.address
  }

  private deriveSolanaSenderAddress(): string {
    const solanaPrivateKey = this.configService.pmm.solana.privateKey
    const solanaPrivateKeyBytes = bs58.decode(solanaPrivateKey)
    const solanaKeypair = Keypair.fromSecretKey(solanaPrivateKeyBytes)
    return solanaKeypair.publicKey.toBase58()
  }

  private deriveLiquidationApprovers(): string[] {
    const liquidationConfig = this.configService.liquidation
    if (!liquidationConfig?.enabled || !liquidationConfig.approvers?.length) {
      return []
    }

    return liquidationConfig.approvers.map((pk) => {
      const wallet = new ethers.Wallet(pk)
      return wallet.address
    })
  }
}
