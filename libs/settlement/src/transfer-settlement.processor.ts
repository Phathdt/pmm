import { Job, Queue } from 'bull';
import { ethers } from 'ethers';

import { stringToHex, toObject, toString } from '@bitfi-mock-pmm/shared';
import { TokenRepository } from '@bitfi-mock-pmm/token';
import { ITypes, Router, Router__factory } from '@bitfi-mock-pmm/typechains';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TransferFactory } from './factories';
import {
    SUBMIT_SETTLEMENT_QUEUE, TRANSFER_SETTLEMENT_QUEUE, TransferSettlementEvent
} from './types';
import { decodeAddress } from './utils';

@Processor(TRANSFER_SETTLEMENT_QUEUE)
export class TransferSettlementProcessor {
  private contract: Router;
  private provider: ethers.JsonRpcProvider;
  private pmmWallet: ethers.Wallet;
  private pmmPrivateKey: string;
  private pmmId: string;

  private readonly logger = new Logger(TransferSettlementProcessor.name);

  constructor(
    private configService: ConfigService,
    private tokenRepo: TokenRepository,
    private transferFactory: TransferFactory,
    @InjectQueue(SUBMIT_SETTLEMENT_QUEUE)
    private submitSettlementQueue: Queue
  ) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL');
    const contractAddress =
      this.configService.getOrThrow<string>('ROUTER_ADDRESS');
    this.pmmPrivateKey =
      this.configService.getOrThrow<string>('PMM_PRIVATE_KEY');

    this.pmmId = stringToHex(this.configService.getOrThrow<string>('PMM_ID'));
    console.log('🚀 ~ TransferSettlementProcessor ~ pmmId:', this.pmmId);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    this.pmmWallet = new ethers.Wallet(this.pmmPrivateKey, this.provider);
    this.contract = Router__factory.connect(contractAddress, this.pmmWallet);
  }

  @Process('transfer')
  async transfer(job: Job<string>) {
    const { tradeId } = toObject(job.data) as TransferSettlementEvent;

    try {
      const pMMSelection = await this.contract.getPMMSelection(tradeId);

      const { pmmInfo } = pMMSelection;

      if (pmmInfo.selectedPMMId !== this.pmmId) {
        this.logger.error(`Tradeid ${tradeId} is not belong this pmm`);
        return;
      }

      const trade: ITypes.TradeDataStructOutput =
        await this.contract.getTradeData(tradeId);

      const paymentTxId = await this.transferToken(pmmInfo, trade, tradeId);

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

    const toToken = await this.tokenRepo.getToken(networkId, toTokenAddress);

    try {
      const strategy = this.transferFactory.getStrategy(toToken.networkType);
      return await strategy.transfer({
        toAddress: toUserAddress,
        amount,
        token: toToken,
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

    const token = await this.tokenRepo.getToken(networkId, tokenAddress);

    return {
      address: decodeAddress(addressHex, token),
      networkId,
      tokenAddress,
    };
  }
}
