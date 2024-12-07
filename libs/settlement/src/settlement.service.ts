import { Queue } from 'bull';
import * as ethers from 'ethers';

import { stringToHex, toString } from '@bitfi-mock-pmm/shared';
import { TradeService } from '@bitfi-mock-pmm/trade';
import { Router, Router__factory } from '@bitfi-mock-pmm/typechains';
import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Trade, TradeStatus } from '@prisma/client';

import {
    AckSettlementDto, AckSettlementResponseDto, GetSettlementSignatureDto,
    SettlementSignatureResponseDto, SignalPaymentDto, SignalPaymentResponseDto
} from './settlement.dto';
import { getCommitInfoHash } from './signatures/getInfoHash';
import getSignature, { SignatureType } from './signatures/getSignature';
import { TRANSFER_SETTLEMENT_QUEUE, TransferSettlementEvent } from './types';

@Injectable()
export class SettlementService {
  private readonly pmmWallet: ethers.Wallet;
  private contract: Router;
  private provider: ethers.JsonRpcProvider;
  private pmmId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tradeService: TradeService,
    @InjectQueue(TRANSFER_SETTLEMENT_QUEUE)
    private transferSettlementQueue: Queue
  ) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL');
    const pmmPrivateKey =
      this.configService.getOrThrow<string>('PMM_PRIVATE_KEY');
    const contractAddress =
      this.configService.getOrThrow<string>('ROUTER_ADDRESS');

    this.pmmId = stringToHex(this.configService.getOrThrow<string>('PMM_ID'));
    console.log('🚀 ~ SettlementService ~ pmmId:', this.pmmId);

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.pmmWallet = new ethers.Wallet(pmmPrivateKey, this.provider);
    this.contract = Router__factory.connect(contractAddress, this.pmmWallet);
  }

  async getSettlementSignature(
    dto: GetSettlementSignatureDto,
    trade: Trade
  ): Promise<SettlementSignatureResponseDto> {
    try {
      const { tradeId } = trade;

      const [presigns, tradeData] = await Promise.all([
        this.contract.getPresigns(tradeId),
        this.contract.getTradeData(tradeId),
      ]);

      const { toChain } = tradeData.tradeInfo;
      const scriptTimeout = BigInt(dto.scriptDeadline);

      const pmmPresign = presigns.find((t) => t.pmmId === this.pmmId);
      if (!pmmPresign) {
        throw new BadRequestException('pmmPresign not found');
      }
      console.log('🚀 ~ pmmPresign.pmmId:', pmmPresign.pmmId);
      console.log('🚀 ~ pmmPresign.pmmRecvAddress:', pmmPresign.pmmRecvAddress);
      console.log('🚀 ~ pmmPresign.toChain[1]:', toChain[1]);
      console.log('🚀 ~ pmmPresign.toChain[2]:', toChain[2]);
      console.log('🚀 ~ dto.committedQuote:', dto.committedQuote);
      console.log('🚀 ~ scriptTimeout:', scriptTimeout);

      const commitInfoHash = getCommitInfoHash(
        pmmPresign.pmmId,
        pmmPresign.pmmRecvAddress,
        toChain[1],
        toChain[2],
        BigInt(dto.committedQuote),
        scriptTimeout
      );
      console.log('🚀 ~ SettlementService ~ commitInfoHash:', commitInfoHash);

      const signerAddress = await this.contract.SIGNER();
      console.log('🚀 ~ SettlementService ~ signerAddress:', signerAddress);
      const signature = await getSignature(
        this.pmmWallet,
        this.provider,
        signerAddress,
        tradeId,
        commitInfoHash,
        SignatureType.VerifyingContract
      );
      console.log('🚀 ~ SettlementService ~ tradeId:', tradeId);
      console.log('🚀 ~ SettlementService ~ signature:', signature);

      await this.tradeService.updateTradeStatus(tradeId, TradeStatus.COMMITTED);

      return {
        tradeId: tradeId,
        signature,
        deadline: parseInt(dto.tradeDeadline),
        error: '',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async ackSettlement(
    dto: AckSettlementDto,
    trade: Trade
  ): Promise<AckSettlementResponseDto> {
    try {
      if (trade.status !== TradeStatus.SETTLING) {
        throw new BadRequestException(`Invalid trade status: ${trade.status}`);
      }

      // Update trade status based on chosen status
      const newStatus =
        dto.chosen === 'true' ? TradeStatus.SETTLING : TradeStatus.FAILED;

      await this.tradeService.updateTradeStatus(
        dto.tradeId,
        newStatus,
        dto.chosen === 'false' ? 'PMM not chosen for settlement' : undefined
      );

      return {
        tradeId: dto.tradeId,
        status: 'acknowledged',
        error: '',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async signalPayment(
    dto: SignalPaymentDto,
    trade: Trade
  ): Promise<SignalPaymentResponseDto> {
    try {
      if (trade.status !== TradeStatus.SETTLING) {
        throw new BadRequestException(`Invalid trade status: ${trade.status}`);
      }

      const eventData = {
        tradeId: dto.tradeId,
      } as TransferSettlementEvent;

      await this.transferSettlementQueue.add('transfer', toString(eventData));

      // You might want to store the protocol fee amount or handle it in your business logic
      await this.tradeService.updateTradeStatus(
        dto.tradeId,
        TradeStatus.SETTLING
      );

      return {
        tradeId: dto.tradeId,
        status: 'acknowledged',
        error: '',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
