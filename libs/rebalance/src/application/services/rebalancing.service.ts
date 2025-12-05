import { Inject, Injectable } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'

import {
  CreateRebalancingInput,
  IRebalancingRepository,
  IRebalancingService,
  Rebalancing,
  RebalancingStatus,
  UpdateRebalancingInput,
} from '../../domain'
import { REBALANCING_REPOSITORY } from '../../infras'

@Injectable()
export class RebalancingService implements IRebalancingService {
  constructor(
    @Inject(REBALANCING_REPOSITORY) private readonly repository: IRebalancingRepository,
    private readonly configService: CustomConfigService
  ) {}

  async create(data: CreateRebalancingInput): Promise<Rebalancing> {
    return this.repository.create(data)
  }

  async findByTradeHash(tradeHash: string): Promise<Rebalancing | null> {
    return this.repository.findByTradeHash(tradeHash)
  }

  async findById(id: number): Promise<Rebalancing | null> {
    return this.repository.findById(id)
  }

  async findPending(): Promise<Rebalancing[]> {
    return this.repository.findPending()
  }

  async findByStatuses(statuses: RebalancingStatus[]): Promise<Rebalancing[]> {
    return this.repository.findByStatuses(statuses)
  }

  async findNeedingRetry(): Promise<Rebalancing[]> {
    return this.repository.findNeedingRetry(this.configService.rebalance.timing.maxRetryDurationHours)
  }

  async updateStatus(id: number, status: RebalancingStatus, data?: UpdateRebalancingInput): Promise<void> {
    return this.repository.updateStatus(id, status, data)
  }

  async incrementRetryCount(id: number): Promise<number> {
    return this.repository.incrementRetryCount(id)
  }

  async exists(tradeHash: string): Promise<boolean> {
    return this.repository.existsByTradeHash(tradeHash)
  }
}
