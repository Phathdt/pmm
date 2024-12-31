import { AxiosError } from 'axios';
import { Job } from 'bull';
import { BytesLike, ethers } from 'ethers';

import { toObject } from '@bitfi-mock-pmm/shared';
import {
  getMakePaymentHash,
  getSignature,
  routerService,
  SignatureType,
  signerService,
  solverService,
} from '@bitfixyz/market-maker-sdk';
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SUBMIT_SETTLEMENT_QUEUE, SubmitSettlementEvent } from './types';

@Processor(SUBMIT_SETTLEMENT_QUEUE)
export class SubmitSettlementProcessor {
  private provider: ethers.JsonRpcProvider;
  private pmmWallet: ethers.Wallet;
  private pmmPrivateKey: string;
  private pmmId: string;

  private solverSerivce = solverService;
  private routerService = routerService;

  private readonly logger = new Logger(SubmitSettlementProcessor.name);

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL');
    this.pmmPrivateKey =
      this.configService.getOrThrow<string>('PMM_PRIVATE_KEY');

    this.pmmId = this.configService.getOrThrow<string>('PMM_ID');
    console.log('🚀 ~ SubmitSettlementProcessor ~ pmmId:', this.pmmId);

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.pmmWallet = new ethers.Wallet(this.pmmPrivateKey, this.provider);
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

      const signerAddress = await this.routerService.getSigner();
      this.logger.log(`Signer address: ${signerAddress}`);

      const signedAt = Math.floor(Date.now() / 1000);

      const makePaymentInfoHash = getMakePaymentHash(
        tradeIds,
        BigInt(signedAt),
        startIdx,
        paymentTxId
      );
      this.logger.log(`Generated payment info hash: ${makePaymentInfoHash}`);

      const domainData = await signerService.getDomain(signerAddress);
      const domain = {
        name: domainData.name,
        version: domainData.version,
        chainId: domainData.chainId,
        verifyingContract: domainData.verifyingContract,
      };
      console.log('🚀 ~ SubmitSettlementProcessor ~ submit ~ domain:', domain);

      const signature = await getSignature(
        this.pmmWallet,
        this.provider,
        signerAddress,
        tradeId,
        makePaymentInfoHash,
        SignatureType.MakePayment,
        domain
      );
      this.logger.log(`Generated signature: ${signature}`);

      const requestPayload = {
        tradeIds: [tradeId],
        pmmId: this.pmmId,
        settlementTx: paymentTxId,
        signature: signature,
        startIndex: 0,
        signedAt: signedAt,
      };

      this.logger.log(
        `Sending request to solver with payload: ${JSON.stringify(
          requestPayload
        )}`
      );

      try {
        const response = await this.solverSerivce.submitSettlementTx(
          requestPayload
        );

        this.logger.log(`Solver response for trade ${tradeId}:`);
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
