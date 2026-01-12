import { Injectable } from '@nestjs/common'
import { DatabaseService, Rebalancing as RebalancingPrisma } from '@optimex-pmm/database'

import { hexlify, randomBytes } from 'ethers'

import {
  CreateRebalancingInput,
  IRebalancingRepository,
  Rebalancing,
  RebalancingStatus,
  RETRYABLE_STATUSES,
  UpdateRebalancingInput,
} from '../../domain'

/**
 * Generates a unique hex string ID for rebalancing records.
 * Uses 16 random bytes (128 bits) for sufficient uniqueness.
 * Format: 0x + 32 hex chars (e.g., 0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d)
 */
function generateRebalancingId(): string {
  return hexlify(randomBytes(16))
}

@Injectable()
export class RebalancingPrismaRepository implements IRebalancingRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateRebalancingInput): Promise<Rebalancing> {
    const result = await this.db.rebalancing.create({
      data: {
        rebalancingId: generateRebalancingId(),
        tradeHash: data.tradeHash,
        tradeId: data.tradeId,
        amount: data.amount,
        realAmount: data.realAmount,
        txId: data.txId,
        vaultAddress: data.vaultAddress,
        optimexStatus: data.optimexStatus,
        tradeCompletedAt: data.tradeCompletedAt,
        status: RebalancingStatus.PENDING,
        retryCount: 0,
        metadata: data.metadata as never,
      },
    })

    return this.mapToEntity(result)
  }

  async findByTradeHash(tradeHash: string): Promise<Rebalancing | null> {
    const result = await this.db.rebalancing.findUnique({
      where: { tradeHash },
    })

    return result ? this.mapToEntity(result) : null
  }

  async findById(id: number): Promise<Rebalancing | null> {
    const result = await this.db.rebalancing.findUnique({
      where: { id },
    })

    return result ? this.mapToEntity(result) : null
  }

  async findPending(): Promise<Rebalancing[]> {
    const results = await this.db.rebalancing.findMany({
      where: {
        status: RebalancingStatus.PENDING,
      },
      orderBy: { createdAt: 'asc' },
    })

    return results.map((r) => this.mapToEntity(r))
  }

  async findByStatuses(statuses: RebalancingStatus[]): Promise<Rebalancing[]> {
    const results = await this.db.rebalancing.findMany({
      where: {
        status: {
          in: statuses as unknown as string[],
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return results.map((r) => this.mapToEntity(r))
  }

  async findNeedingRetry(maxRetryDurationHours: number): Promise<Rebalancing[]> {
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - maxRetryDurationHours)

    const results = await this.db.rebalancing.findMany({
      where: {
        status: {
          in: RETRYABLE_STATUSES as unknown as string[],
        },
        createdAt: {
          gte: cutoffTime,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return results.map((r) => this.mapToEntity(r))
  }

  async updateStatus(id: number, status: RebalancingStatus, data?: UpdateRebalancingInput): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    }

    if (data) {
      const { metadata, ...rest } = data
      Object.assign(updateData, rest)
      if (metadata !== undefined) {
        updateData.metadata = metadata as never
      }
    }

    await this.db.rebalancing.update({
      where: { id },
      data: updateData,
    })
  }

  async incrementRetryCount(id: number): Promise<number> {
    const result = await this.db.rebalancing.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        updatedAt: new Date(),
      },
    })

    return result.retryCount
  }

  async existsByTradeHash(tradeHash: string): Promise<boolean> {
    const count = await this.db.rebalancing.count({
      where: { tradeHash },
    })

    return count > 0
  }

  private mapToEntity(data: RebalancingPrisma): Rebalancing {
    return {
      id: data.id,
      rebalancingId: data.rebalancingId,
      tradeHash: data.tradeHash,
      tradeId: data.tradeId,
      amount: data.amount,
      realAmount: data.realAmount,
      txId: data.txId,
      vaultAddress: data.vaultAddress,
      optimexStatus: data.optimexStatus,
      mempoolVerified: data.mempoolVerified,
      depositAddress: data.depositAddress,
      nearVaultTxId: data.nearVaultTxId,
      quoteId: data.quoteId,
      oraclePrice: data.oraclePrice,
      quotePrice: data.quotePrice,
      slippageBps: data.slippageBps,
      expectedUsdc: data.expectedUsdc,
      actualUsdc: data.actualUsdc,
      nearTxId: data.nearTxId,
      nearDepositId: data.nearDepositId,
      status: data.status as RebalancingStatus,
      retryCount: data.retryCount,
      error: data.error,
      metadata: data.metadata as Record<string, unknown> | null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      tradeCompletedAt: data.tradeCompletedAt,
    }
  }
}
