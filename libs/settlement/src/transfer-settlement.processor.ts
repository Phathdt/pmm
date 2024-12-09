import {
  ensureHexPrefix,
  ITypes,
  routerService,
  tokenService,
  transferService,
} from 'bitfi-market-maker-sdk';
import { Job, Queue } from 'bull';
import { ethers } from 'ethers';

import { stringToHex, toObject, toString } from '@bitfi-mock-pmm/shared';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  SUBMIT_SETTLEMENT_QUEUE,
  TRANSFER_SETTLEMENT_QUEUE,
  TransferSettlementEvent,
} from './types';
import { decodeAddress } from './utils';

@Processor(TRANSFER_SETTLEMENT_QUEUE)
export class TransferSettlementProcessor {
  private pmmId: string;

  private tokenService = tokenService;
  private transferSerivce = transferService;
  private routerService = routerService;

  private readonly logger = new Logger(TransferSettlementProcessor.name);

  constructor(
    private configService: ConfigService,
    @InjectQueue(SUBMIT_SETTLEMENT_QUEUE)
    private submitSettlementQueue: Queue
  ) {
    this.pmmId = stringToHex(this.configService.getOrThrow<string>('PMM_ID'));
  }

  @Process('transfer')
  async transfer(job: Job<string>) {
    const { tradeId } = toObject(job.data) as TransferSettlementEvent;

    try {
      const pMMSelection = await this.routerService.getPMMSelection(tradeId);

      const { pmmInfo } = pMMSelection;

      if (pmmInfo.selectedPMMId !== this.pmmId) {
        this.logger.error(`Tradeid ${tradeId} is not belong this pmm`);
        return;
      }

      const trade: ITypes.TradeDataStructOutput =
        await this.routerService.getTradeData(tradeId);

      const paymentTxId = ensureHexPrefix(
        await this.transferToken(pmmInfo, trade, tradeId)
      );

      const eventData = {
        tradeId: tradeId,
        paymentTxId,
      } as TransferSettlementEvent;

      await this.submitSettlementQueue.add('submit', toString(eventData));

      this.logger.log(
        `Processing transfer tradeId ${tradeId} success with paymentId ${paymentTxId}`
      );
    } catch (error) {
      this.logger.error(
        `Processing transfer tradeId ${tradeId} failed: ${error}`
      );
    }
  }

  private async transferToken(
    pmmInfo: { amountOut: bigint },
    trade: ITypes.TradeDataStructOutput,
    tradeId: string
  ): Promise<string> {
    const amount = pmmInfo.amountOut;
    const {
      address: toUserAddress,
      networkId,
      tokenAddress: toTokenAddress,
    } = await this.decodeChainInfo(trade.tradeInfo.toChain);

    this.logger.log(`
      Decoded chain info:
      - To Address: ${toUserAddress}
      - Chain: ${networkId}
      - Token: ${toTokenAddress}
    `);

    try {
      return await this.transferSerivce.transfer({
        toAddress: toUserAddress,
        amount,
        networkId,
        tokenAddress: toTokenAddress,
        tradeId,
      });
    } catch (error) {
      this.logger.error('Transfer token error:', error);
      throw error;
    }
  }

  private async decodeChainInfo(chainInfo: [string, string, string]): Promise<{
    address: string;
    networkId: string;
    tokenAddress: string;
  }> {
    const [addressHex, networkIdHex, tokenAddressHex] = chainInfo;

    const networkId = ethers.toUtf8String(networkIdHex);
    const tokenAddress = ethers.toUtf8String(tokenAddressHex);

    const token = await this.tokenService.getToken(networkId, tokenAddress);

    return {
      address: decodeAddress(addressHex, token),
      networkId,
      tokenAddress,
    };
  }
}
