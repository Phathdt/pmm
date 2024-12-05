import { Queue } from 'bull';
import { ethers } from 'ethers';

import { toString } from '@bitfi-mock-pmm/shared';
import { Router, Router__factory } from '@bitfi-mock-pmm/typechains';
import { InjectQueue } from '@nestjs/bull';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SelectPMMEvent } from './types';

@Injectable()
export class SettlementWatcher implements OnModuleInit {
  private contract: Router;
  private provider: ethers.JsonRpcProvider;
  private readonly logger = new Logger(SettlementWatcher.name);
  private lastProcessedBlock = 0;
  private readonly CACHE_KEY = 'router:pmm-lastProcessedBlock';
  private pollingDelayTime = 0;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectQueue('router-select-pmm-events')
    private selectPMMEventsQueue: Queue
  ) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL');
    const contractAddress =
      this.configService.getOrThrow<string>('ROUTER_ADDRESS');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = Router__factory.connect(contractAddress, this.provider);
    this.pollingDelayTime =
      this.configService.get<number>('POOLING_DELAY_TIME') || 30000;
  }

  async onModuleInit() {
    await this.initLastProcessedBlock();
    this.startPolling();
  }

  private async initLastProcessedBlock() {
    const savedBlock = await this.cacheManager.get<string>(this.CACHE_KEY);
    if (savedBlock) {
      this.lastProcessedBlock = parseInt(savedBlock, 10);
      this.logger.log(`Resuming from block ${this.lastProcessedBlock}`);
    } else {
      this.lastProcessedBlock = await this.provider.getBlockNumber();
      this.logger.log(`Starting from current block ${this.lastProcessedBlock}`);
    }
    await this.saveLastProcessedBlock();
  }

  private async saveLastProcessedBlock() {
    await this.cacheManager.set(
      this.CACHE_KEY,
      this.lastProcessedBlock.toString()
    );
  }

  private startPolling() {
    setInterval(async () => {
      await this.checkForNewEvents();
    }, this.pollingDelayTime);

    this.logger.log(
      'Started polling for ConfirmDeposit and SelectPMM events...'
    );
  }

  private async checkForNewEvents() {
    try {
      const latestBlock = await this.provider.getBlockNumber();
      const maxBlockRange = 1000;

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(fromBlock + maxBlockRange - 1, latestBlock);

      if (fromBlock > toBlock) {
        this.logger.log('No new blocks to process');
        return;
      }

      const selectPMMFilter = this.contract.filters.SelectPMM();

      const selectPMMLogs = await this.contract.queryFilter(
        selectPMMFilter,
        fromBlock,
        toBlock
      );

      for (const log of selectPMMLogs) {
        const eventData: SelectPMMEvent = {
          tradeId: log.args.tradeId,
        };

        await this.selectPMMEventsQueue.add('selectPMM', toString(eventData));

        this.logger.log(`Queued SelectPMM event: ${log.transactionHash}`);
      }

      this.lastProcessedBlock = toBlock;
      await this.saveLastProcessedBlock();

      this.logger.log(`Processed blocks from ${fromBlock} to ${toBlock}`);
      this.logger.log(
        `Next check will start from block ${this.lastProcessedBlock + 1}`
      );
    } catch (error) {
      this.logger.error('Error checking for new events:', error);
    }
  }
}
