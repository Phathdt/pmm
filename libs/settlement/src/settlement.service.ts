import * as ethers from 'ethers';

import { TradeService } from '@bitfi-mock-pmm/trade';
import { Router, Router__factory } from '@bitfi-mock-pmm/typechains';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Trade, TradeStatus } from '@prisma/client';

import {
  AckSettlementDto,
  AckSettlementResponseDto,
  GetSettlementSignatureDto,
  SettlementSignatureResponseDto,
} from './settlement.dto';
import { getCommitInfoHash } from './signatures/getInfoHash';
import getSignature, { SignatureType } from './signatures/getSignature';

@Injectable()
export class SettlementService {
  private readonly pmmWallet: ethers.Wallet;
  private contract: Router;
  private provider: ethers.JsonRpcProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly tradeService: TradeService
  ) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL');
    const pmmPrivateKey =
      this.configService.getOrThrow<string>('PMM_PRIVATE_KEY');

    const contractAddress = this.configService.getOrThrow<string>(
      'ROUTER_CONTRACT_ADDRESS'
    );

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.pmmWallet = new ethers.Wallet(pmmPrivateKey, this.provider);

    this.contract = Router__factory.connect(contractAddress, this.pmmWallet);
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

      const { tradeId } = trade;

      const pmmId = ethers.toBeHex(this.pmmWallet.address, 32);

      const [presigns, tradeData] = await Promise.all([
        this.contract.getPresigns(tradeId),
        this.contract.getTradeData(tradeId),
      ]);

      const { toChain } = tradeData.tradeInfo;
      const { scriptTimeout } = tradeData.scriptInfo;

      const pmmPresign = presigns.find((t) => t.pmmId === pmmId);
      if (!pmmPresign) {
        throw new BadRequestException('pmmPresign not found');
      }

      const commitInfoHash = getCommitInfoHash(
        pmmPresign.pmmId,
        pmmPresign.pmmRecvAddress,
        toChain[1],
        toChain[2],
        BigInt(dto.settlementQuote),
        scriptTimeout
      );

      const signerAddress = await this.contract.SIGNER();
      const signature = await getSignature(
        this.pmmWallet,
        this.provider,
        signerAddress,
        tradeId,
        commitInfoHash,
        SignatureType.VerifyingContract
      );

      await this.tradeService.updateTradeQuote(tradeId, {
        settlementQuote: dto.settlementQuote,
      });

      await this.tradeService.updateTradeStatus(tradeId, TradeStatus.SETTLING);

      return {
        tradeId: tradeId,
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
