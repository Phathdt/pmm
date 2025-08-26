import { InjectQueue } from '@nestjs/bull'
import { BadRequestException, HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { isSameAddress, stringToHex, toString } from '@optimex-pmm/shared'
import { TradeService } from '@optimex-pmm/trade'
import {
  getCommitInfoHash,
  getSignature,
  routerService,
  SignatureType,
  signerService,
  Token,
  tokenService,
} from '@optimex-xyz/market-maker-sdk'
import { Trade, TradeStatus } from '@prisma/client'

import { Queue } from 'bull'
import * as ethers from 'ethers'

import { SETTLEMENT_QUEUE } from './const'
import {
  AckSettlementDto,
  AckSettlementResponseDto,
  GetSettlementSignatureDto,
  SettlementSignatureResponseDto,
  SignalPaymentDto,
  SignalPaymentResponseDto,
} from './settlement.dto'
import { TransferSettlementEvent } from './types'
import { l2Decode, l2Encode } from './utils'

@Injectable()
export class SettlementService {
  private readonly pmmWallet: ethers.Wallet
  private provider: ethers.JsonRpcProvider
  private pmmId: string
  private readonly EVM_ADDRESS: string
  private readonly BTC_ADDRESS: string
  private readonly PMM_SOLANA_ADDRESS: string

  private routerService = routerService
  private tokenService = tokenService

  constructor(
    private readonly configService: ConfigService,
    private readonly tradeService: TradeService,
    @InjectQueue(SETTLEMENT_QUEUE.TRANSFER.NAME)
    private transferSettlementQueue: Queue
  ) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL')
    const pmmPrivateKey = this.configService.getOrThrow<string>('PMM_PRIVATE_KEY')

    this.EVM_ADDRESS = this.configService.getOrThrow<string>('PMM_EVM_ADDRESS')
    this.BTC_ADDRESS = this.configService.getOrThrow<string>('PMM_BTC_ADDRESS')
    this.PMM_SOLANA_ADDRESS = this.configService.getOrThrow<string>('PMM_SOLANA_ADDRESS')

    this.pmmId = stringToHex(this.configService.getOrThrow<string>('PMM_ID'))

    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    this.pmmWallet = new ethers.Wallet(pmmPrivateKey, this.provider)
  }

  async getSettlementSignature(dto: GetSettlementSignatureDto, trade: Trade): Promise<SettlementSignatureResponseDto> {
    try {
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
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new BadRequestException(error.message)
    }
  }

  async ackSettlement(dto: AckSettlementDto): Promise<AckSettlementResponseDto> {
    try {
      // Update trade status based on chosen status
      const newStatus = dto.chosen ? TradeStatus.SELECTED : TradeStatus.FAILED

      await this.tradeService.updateTradeStatus(
        dto.tradeId,
        newStatus,
        dto.chosen ? undefined : 'PMM not chosen for settlement'
      )

      return {
        tradeId: dto.tradeId,
        status: 'acknowledged',
        error: '',
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new BadRequestException(error.message)
    }
  }

  async signalPayment(dto: SignalPaymentDto, trade: Trade): Promise<SignalPaymentResponseDto> {
    try {
      if (trade.status !== TradeStatus.SELECTED) {
        throw new BadRequestException(`Invalid trade status: ${trade.status}`)
      }

      const eventData = {
        tradeId: dto.tradeId,
      } as TransferSettlementEvent

      await this.transferSettlementQueue.add(SETTLEMENT_QUEUE.TRANSFER.JOBS.PROCESS, toString(eventData), {
        removeOnComplete: {
          age: 24 * 3600,
        },
        removeOnFail: {
          age: 24 * 3600,
        },
      })

      // You might want to store the protocol fee amount or handle it in your business logic
      await this.tradeService.updateTradeStatus(dto.tradeId, TradeStatus.SETTLING)

      return {
        tradeId: dto.tradeId,
        status: 'acknowledged',
        error: '',
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error
      }
      throw new BadRequestException(error.message)
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
}
