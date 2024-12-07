import { AxiosError } from 'axios';
import { Job } from 'bull';
import { BytesLike, ethers } from 'ethers';

import { ReqService } from '@bitfi-mock-pmm/req';
import { toObject } from '@bitfi-mock-pmm/shared';
import { Router, Router__factory } from '@bitfi-mock-pmm/typechains';
import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getMakePaymentHash } from './signatures/getInfoHash';
import getSignature, { SignatureType } from './signatures/getSignature';
import {
    SUBMIT_SETTLEMENT_QUEUE, SubmitSettlementEvent, SubmitSettlementTxResponse
} from './types';

@Processor(SUBMIT_SETTLEMENT_QUEUE)
export class SubmitSettlementProcessor {
  private contract: Router;
  private provider: ethers.JsonRpcProvider;
  private pmmWallet: ethers.Wallet;
  private pmmPrivateKey: string;
  private pmmId: string;

  private readonly logger = new Logger(SubmitSettlementProcessor.name);

  constructor(
    private configService: ConfigService,
    @Inject('SOLVER_REQ_SERVICE')
    private readonly reqService: ReqService
  ) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL');
    const contractAddress =
      this.configService.getOrThrow<string>('ROUTER_ADDRESS');
    this.pmmPrivateKey =
      this.configService.getOrThrow<string>('PMM_PRIVATE_KEY');

    this.pmmId = this.configService.getOrThrow<string>('PMM_ID');
    console.log('🚀 ~ SubmitSettlementProcessor ~ pmmId:', this.pmmId);

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.pmmWallet = new ethers.Wallet(this.pmmPrivateKey, this.provider);
    this.contract = Router__factory.connect(contractAddress, this.pmmWallet);
  }

  @Process('submit')
  async submit(job: Job<string>) {
    const { tradeId, paymentTxId } = toObject(
      job.data
    ) as SubmitSettlementEvent;

    this.logger.log(`Starting settlement submission for Trade ID: ${tradeId}`);
    this.logger.log(`Payment Transaction ID: ${paymentTxId}`);

    try {
      const tradeIds: BytesLike[] = [tradeId];
      const startIdx = BigInt(tradeIds.indexOf(tradeId));

      const signerAddress = await this.contract.SIGNER();
      this.logger.log(`Signer address: ${signerAddress}`);

      const makePaymentInfoHash = getMakePaymentHash(
        tradeIds,
        startIdx,
        paymentTxId
      );
      this.logger.log(`Generated payment info hash: ${makePaymentInfoHash}`);

      const signature = await getSignature(
        this.pmmWallet,
        this.provider,
        signerAddress,
        tradeId,
        makePaymentInfoHash,
        SignatureType.MakePayment
      );
      this.logger.log(`Generated signature: ${signature}`);

      const requestPayload = {
        tradeIds: [tradeId],
        pmmId: this.pmmId,
        settlementTx: paymentTxId,
        signature: signature,
        startIndex: 0,
      };
      this.logger.log(
        `Sending request to solver with payload: ${JSON.stringify(
          requestPayload
        )}`
      );

      try {
        const response = await this.reqService.post<SubmitSettlementTxResponse>(
          {
            url: '/submit-settlement-tx',
            headers: {
              'Content-Type': 'application/json',
            },
            data: requestPayload,
          }
        );

        this.logger.log(`Solver response for trade ${tradeId}:`);
        this.logger.log(`Status: ${response.status}`);
        this.logger.log(`Response data: ${JSON.stringify(response)}`);
        this.logger.log(
          `Submit settlement for trade ${tradeId} completed successfully`
        );

        return response;
      } catch (axiosError) {
        if (axiosError instanceof AxiosError) {
          this.logger.error(`API Request failed for trade ${tradeId}:`);
          this.logger.error(`Status: ${axiosError.response?.status}`);
          this.logger.error(`Error message: ${axiosError.message}`);
          this.logger.error(
            `Response data: ${JSON.stringify(axiosError.response?.data)}`
          );
          this.logger.error(
            `Request config: ${JSON.stringify({
              method: axiosError.config?.method,
              url: axiosError.config?.url,
              headers: axiosError.config?.headers,
              data: axiosError.config?.data,
            })}`
          );
        }
        throw axiosError; // Re-throw to be caught by outer catch block
      }
    } catch (error) {
      this.logger.error(`Submit settlement failed for trade ${tradeId}:`);
      if (error instanceof Error) {
        this.logger.error(`Error name: ${error.name}`);
        this.logger.error(`Error message: ${error.message}`);
        this.logger.error(`Stack trace: ${error.stack}`);
      } else {
        this.logger.error(`Unknown error: ${error}`);
      }
      throw error; // Re-throw the error for the queue to handle
    }
  }
}
