import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { deriveP2TRAddress } from '@optimex-pmm/bitcoin'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { QueueService } from '@optimex-pmm/queue'
import { isSameAddress, stringToHex } from '@optimex-pmm/shared'
import { ITradeService, TRADE_SERVICE, TradeStatus } from '@optimex-pmm/trade'
import {
  getCommitInfoHash,
  getSignature,
  routerService,
  SignatureType,
  signerService,
  Token,
  tokenService,
} from '@optimex-xyz/market-maker-sdk'
import { Trade } from '@prisma/client'

import * as ethers from 'ethers'

import {
  AckSettlementDto,
  AckSettlementResponseDto,
  GetSettlementSignatureDto,
  ISettlementService,
  SettlementSignatureResponseDto,
  SignalPaymentDto,
  SignalPaymentResponseDto,
  TransferSettlementEvent,
} from '../../domain'
import { SETTLEMENT_REDIS_QUEUE } from '../../infras'
import { l2Decode, l2Encode } from '../../utils'

@Injectable()
export class SettlementService implements ISettlementService {
  private readonly pmmWallet: ethers.Wallet
  private provider: ethers.JsonRpcProvider
  private pmmId: string
  private readonly EVM_ADDRESS: string
  private readonly BTC_ADDRESS: string
  private readonly PMM_SOLANA_ADDRESS: string

  private routerService = routerService
  private tokenService = tokenService

  constructor(
    @Inject(TRADE_SERVICE) private readonly tradeService: ITradeService,
    private readonly configService: CustomConfigService,
    private readonly queueService: QueueService
  ) {
    const pmmPrivateKey = this.configService.pmm.privateKey

    this.EVM_ADDRESS = this.configService.pmm.evm.address
    this.BTC_ADDRESS = deriveP2TRAddress({ privateKeyWIF: this.configService.pmm.btc.privateKey }).address
    this.PMM_SOLANA_ADDRESS = this.configService.pmm.solana.address

    this.pmmId = stringToHex(this.configService.pmm.id)

    this.provider = new ethers.JsonRpcProvider(this.configService.rpc.optimexUrl)
    this.pmmWallet = new ethers.Wallet(pmmPrivateKey, this.provider)
  }

  async getSettlementSignature(dto: GetSettlementSignatureDto, trade: Trade): Promise<SettlementSignatureResponseDto> {
    const { tradeId } = trade

    const [presigns, tradeData] = await Promise.all([
      this.routerService.getSettlementPresigns(tradeId),
      this.routerService.getTradeData(tradeId),
    ])

    const { toChain, fromChain } = tradeData.tradeInfo
    const fromToken = await this.tokenService.getToken(l2Decode(fromChain[1]), l2Decode(fromChain[2]))
    const pmmAddress = this.getPmmAddressByNetworkType(fromToken)

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)

    const pmmPresign = presigns.find((t) => t.pmmId === this.pmmId)
    if (!pmmPresign) {
      throw new BadRequestException('pmmPresign not found')
    }

    if (!isSameAddress(l2Decode(pmmPresign.pmmRecvAddress), pmmAddress)) {
      throw new BadRequestException('pmmRecvAddress not match')
    }

    const amountOut = BigInt(dto.committedQuote)

    const commitInfoHash = getCommitInfoHash(
      this.pmmId,
      l2Encode(pmmAddress),
      toChain[1],
      toChain[2],
      amountOut,
      deadline
    )

    const signerAddress = await this.routerService.getSigner()

    const domain = await signerService.getDomain()

    const signature = await getSignature(
      this.pmmWallet,
      this.provider,
      signerAddress,
      tradeId,
      commitInfoHash,
      SignatureType.VerifyingContract,
      domain
    )

    await this.tradeService.updateTradeStatus(tradeId, TradeStatus.COMMITTED)

    return {
      tradeId: tradeId,
      signature,
      deadline: Number(deadline),
      error: '',
    }
  }

  async ackSettlement(dto: AckSettlementDto): Promise<AckSettlementResponseDto> {
    // Update trade status based on chosen status
    const newStatus = dto.chosen ? TradeStatus.SELECTED : TradeStatus.FAILED

    await this.tradeService.updateTradeStatus(
      dto.tradeId,
      newStatus,
      dto.chosen ? undefined : { error: 'PMM not chosen for settlement' }
    )

    return {
      tradeId: dto.tradeId,
      status: 'acknowledged',
      error: '',
    }
  }

  async signalPayment(dto: SignalPaymentDto, trade: Trade): Promise<SignalPaymentResponseDto> {
    if (trade.status !== TradeStatus.SELECTED) {
      throw new BadRequestException(`Invalid trade status: ${trade.status}`)
    }

    const eventData = {
      tradeId: dto.tradeId,
    } as TransferSettlementEvent

    // Get the token to determine which platform queue to use
    const token = await this.tokenService.getTokenByTokenId(trade.toTokenId)
    const queueName = this.getQueueNameByNetworkType(token.networkType.toUpperCase())

    await this.queueService.pushToQueue(queueName, eventData)

    // You might want to store the protocol fee amount or handle it in your business logic
    await this.tradeService.updateTradeStatus(dto.tradeId, TradeStatus.SETTLING)

    return {
      tradeId: dto.tradeId,
      status: 'acknowledged',
      error: '',
    }
  }

  private getPmmAddressByNetworkType(token: Token): string {
    switch (token.networkType.toUpperCase()) {
      case 'EVM':
        return this.EVM_ADDRESS
      case 'BTC':
      case 'TBTC':
        return this.BTC_ADDRESS
      case 'SOLANA':
        return this.PMM_SOLANA_ADDRESS
      default:
        throw new BadRequestException(`Unsupported network type: ${token.networkType}`)
    }
  }

  private getQueueNameByNetworkType(networkType: string): string {
    switch (networkType.toUpperCase()) {
      case 'EVM':
        return SETTLEMENT_REDIS_QUEUE.EVM_TRANSFER.NAME
      case 'BTC':
      case 'TBTC':
        return SETTLEMENT_REDIS_QUEUE.BTC_TRANSFER.NAME
      case 'SOLANA':
        return SETTLEMENT_REDIS_QUEUE.SOLANA_TRANSFER.NAME
      default:
        throw new BadRequestException(`Unsupported network type: ${networkType}`)
    }
  }
}
