import { Processor, WorkerHost } from '@nestjs/bullmq'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { ProcessorHelper } from '@optimex-pmm/queue'
import { l2Encode, SETTLEMENT_QUEUE, SubmitSettlementEvent } from '@optimex-pmm/settlement'
import { toObject } from '@optimex-pmm/shared'
import {
  getMakePaymentHash,
  getSignature,
  routerService,
  SignatureType,
  signerService,
  solverService,
} from '@optimex-xyz/market-maker-sdk'

import { AxiosError } from 'axios'
import { Job } from 'bullmq'
import { BytesLike, ethers } from 'ethers'

@Processor(SETTLEMENT_QUEUE.SUBMIT.NAME)
export class SubmitSettlementProcessor extends WorkerHost {
  private provider: ethers.JsonRpcProvider
  private pmmWallet: ethers.Wallet
  private pmmPrivateKey: string
  private pmmId: string

  private solverSerivce = solverService
  private routerService = routerService

  private readonly logger: EnhancedLogger
  private readonly processorHelper: ProcessorHelper

  constructor(
    private configService: CustomConfigService,
    logger: EnhancedLogger
  ) {
    super()
    this.logger = logger.with({ context: SubmitSettlementProcessor.name })
    this.processorHelper = new ProcessorHelper(this.logger)

    this.pmmPrivateKey = this.configService.pmm.privateKey
    this.pmmId = this.configService.pmm.id

    this.provider = new ethers.JsonRpcProvider(this.configService.rpc.optimexUrl)
    this.pmmWallet = new ethers.Wallet(this.pmmPrivateKey, this.provider)
  }

  async process(job: Job<string, unknown, string>): Promise<void> {
    return this.processorHelper.executeWithTraceId(job, async (job) => {
      const { tradeId, paymentTxId: paymentId } = toObject(job.data) as SubmitSettlementEvent

      this.logger.log({
        message: 'Starting settlement submission',
        tradeId,
        paymentId,
        operation: 'settlement_submission_start',
        timestamp: new Date().toISOString(),
      })

      try {
        const paymentTxId = l2Encode(paymentId)
        const tradeIds: BytesLike[] = [tradeId]
        const startIdx = BigInt(tradeIds.indexOf(tradeId))

        const signerAddress = await this.routerService.getSigner()

        const signedAt = Math.floor(Date.now() / 1000)

        const makePaymentInfoHash = getMakePaymentHash(tradeIds, BigInt(signedAt), startIdx, paymentTxId)

        const domain = await signerService.getDomain()

        const signature = await getSignature(
          this.pmmWallet,
          this.provider,
          signerAddress,
          tradeId,
          makePaymentInfoHash,
          SignatureType.MakePayment,
          domain
        )
        this.logger.log({
          message: 'Generated signature for settlement',
          tradeId,
          signature,
          operation: 'signature_generation',
          timestamp: new Date().toISOString(),
        })

        const requestPayload = {
          tradeIds: [tradeId],
          pmmId: this.pmmId,
          settlementTx: paymentTxId,
          signature: signature,
          startIndex: 0,
          signedAt: signedAt,
        }

        this.logger.log({
          message: 'Sending request to solver',
          tradeId,
          requestPayload,
          operation: 'solver_request',
          timestamp: new Date().toISOString(),
        })

        try {
          const response = await this.solverSerivce.submitSettlementTx(requestPayload)

          this.logger.log({
            message: 'Settlement submission completed successfully',
            tradeId,
            response,
            operation: 'settlement_submission_success',
            timestamp: new Date().toISOString(),
          })
        } catch (axiosError) {
          if (axiosError instanceof AxiosError) {
            this.logger.error({
              message: 'API request failed for settlement submission',
              tradeId,
              error: axiosError.message,
              status: axiosError.response?.status,
              responseData: axiosError.response?.data,
              requestConfig: {
                method: axiosError.config?.method,
                url: axiosError.config?.url,
                headers: axiosError.config?.headers,
                data: axiosError.config?.data,
              },
              operation: 'settlement_submission_api_error',
              timestamp: new Date().toISOString(),
            })
          }
          throw axiosError // Re-throw to be caught by outer catch block
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        const errorStack = error instanceof Error ? error.stack : undefined

        this.logger.error({
          message: 'Submit settlement error',
          tradeId,
          error: errorMessage,
          stack: errorStack,
          operation: 'settlement_submission_error',
          timestamp: new Date().toISOString(),
        })

        throw error // Re-throw the error for the queue to handle
      }
    })
  }
}
