import { Job } from 'bull';
import { BytesLike, ethers } from 'ethers';

import { ReqService } from '@bitfi-mock-pmm/req';
import { toObject, toString } from '@bitfi-mock-pmm/shared';
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

    try {
      const tradeIds: BytesLike[] = [tradeId];
      const startIdx = BigInt(tradeIds.indexOf(tradeId));

      const signerAddress = await this.contract.SIGNER();
      const makePaymentInfoHash = getMakePaymentHash(
        tradeIds,
        startIdx,
        paymentTxId
      );
      const signature = await getSignature(
        this.pmmWallet,
        this.provider,
        signerAddress,
        tradeId,
        makePaymentInfoHash,
        SignatureType.MakePayment
      );

      const response = await this.reqService.post<SubmitSettlementTxResponse>({
        url: '/submit-settlement-tx',
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          tradeIds: [tradeId],
          pmmId: this.pmmId,
          settlementTx: paymentTxId,
          signature: signature,
          startIndex: 0,
        },
      });

      this.logger.log(
        `response from solver for ${tradeId}: ${toString(response)}`
      );
      this.logger.log(`Submit settlement for trade ${tradeId} completed`);
    } catch (error) {
      this.logger.error(
        `Submit settlement tradeId ${tradeId} failed: ${error}`
      );
    }
  }
}
