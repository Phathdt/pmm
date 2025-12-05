import { CreateRebalancingInput, Rebalancing, RebalancingStatus, UpdateRebalancingInput } from '../entities'

export interface IRebalancingRepository {
  create(data: CreateRebalancingInput): Promise<Rebalancing>
  findByTradeHash(tradeHash: string): Promise<Rebalancing | null>
  findById(id: number): Promise<Rebalancing | null>
  findPending(): Promise<Rebalancing[]>
  findByStatuses(statuses: RebalancingStatus[]): Promise<Rebalancing[]>
  findNeedingRetry(maxRetryDurationHours: number): Promise<Rebalancing[]>
  updateStatus(id: number, status: RebalancingStatus, data?: UpdateRebalancingInput): Promise<void>
  incrementRetryCount(id: number): Promise<number>
  existsByTradeHash(tradeHash: string): Promise<boolean>
}
