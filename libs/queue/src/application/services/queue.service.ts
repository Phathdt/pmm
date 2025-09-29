import { InjectRedis } from '@nestjs-modules/ioredis'
import { Injectable, Logger } from '@nestjs/common'
import { toObject, toString } from '@optimex-pmm/shared'

import Redis from 'ioredis'

import { IQueueService } from '../../domain'

@Injectable()
export class QueueService implements IQueueService {
  private readonly logger = new Logger(QueueService.name)

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async pushToQueue(queueName: string, data: unknown): Promise<number> {
    try {
      const serializedData = toString(data)
      const result = await this.redis.lpush(queueName, serializedData)
      this.logger.debug(`Pushed job to queue ${queueName}`, {
        queueName,
        dataSize: serializedData.length,
      })
      return result
    } catch (error: unknown) {
      this.logger.error(`Failed to push to queue ${queueName}`, {
        error: error instanceof Error ? error.message : String(error),
        queueName,
      })
      throw error
    }
  }

  async popFromQueue(queueName: string, count = 1): Promise<unknown[]> {
    try {
      const pipeline = this.redis.pipeline()
      for (let i = 0; i < count; i++) {
        pipeline.rpop(queueName)
      }

      const results = await pipeline.exec()
      if (!results) return []

      const parsedResults = results
        .map((result) => result[1])
        .filter((item) => item !== null)
        .map((item) => toObject(item as string))

      this.logger.debug(`Popped ${parsedResults.length} jobs from queue ${queueName}`, {
        queueName,
        jobCount: parsedResults.length,
      })
      return parsedResults
    } catch (error: unknown) {
      this.logger.error(`Failed to pop from queue ${queueName}`, {
        error: error instanceof Error ? error.message : String(error),
        queueName,
      })
      throw error
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    try {
      const length = await this.redis.llen(queueName)
      this.logger.debug(`Queue ${queueName} length: ${length}`)
      return length
    } catch (error: unknown) {
      this.logger.error(`Failed to get queue length for ${queueName}`, {
        error: error instanceof Error ? error.message : String(error),
        queueName,
      })
      throw error
    }
  }

  async clearQueue(queueName: string): Promise<void> {
    try {
      await this.redis.del(queueName)
      this.logger.log(`Cleared queue ${queueName}`)
    } catch (error: unknown) {
      this.logger.error(`Failed to clear queue ${queueName}`, {
        error: error instanceof Error ? error.message : String(error),
        queueName,
      })
      throw error
    }
  }
}
