import * as ethers from 'ethers';

import { TradeService } from '@bitfi-mock-pmm/trade';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Trade, TradeStatus } from '@prisma/client';

import {
  AckSettlementDto,
  AckSettlementResponseDto,
  GetSettlementSignatureDto,
  SettlementSignatureResponseDto,
} from './settlement.dto';

@Injectable()
export class SettlementService {
  private readonly signer: ethers.Wallet;

  constructor(
    private readonly configService: ConfigService,
    private readonly tradeService: TradeService
  ) {
    const pmmPrivateKey =
      this.configService.getOrThrow<string>('PMM_PRIVATE_KEY');
    this.signer = new ethers.Wallet(pmmPrivateKey);
  }

  private async generateSignature(
    tradeId: string,
    committedQuote: string,
    settlementQuote: string
  ): Promise<string> {
    const messageHash = ethers.solidityPackedKeccak256(
      ['string', 'uint256', 'uint256'],
      [tradeId, committedQuote, settlementQuote]
    );

    const signature = await this.signer.signMessage(
      ethers.getBytes(messageHash)
    );

    return signature;
  }

  async getSettlementSignature(
    dto: GetSettlementSignatureDto,
    trade: Trade
  ): Promise<SettlementSignatureResponseDto> {
    try {
      await this.tradeService.updateTradeStatus(
        trade.tradeId,
        TradeStatus.COMMITTED
      );

      const signature = await this.generateSignature(
        dto.tradeId,
        dto.committedQuote,
        dto.settlementQuote
      );

      await this.tradeService.updateTradeQuote(dto.tradeId, {
        settlementQuote: dto.settlementQuote,
      });

      await this.tradeService.updateTradeStatus(
        dto.tradeId,
        TradeStatus.SETTLING
      );

      return {
        tradeId: dto.tradeId,
        signature,
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
        throw new BadRequestException(
          dto.tradeId,
          `Invalid trade status: ${trade.status}`
        );
      }

      await this.tradeService.updateTradeStatus(
        dto.tradeId,
        TradeStatus.COMPLETED
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
      throw new BadRequestException(dto.tradeId, error.message);
    }
  }
}
