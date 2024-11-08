import { Job } from 'bull';
import { ethers, toBeHex } from 'ethers';

import { ReqService } from '@bitfi-mock-pmm/req';
import { toObject, toString } from '@bitfi-mock-pmm/shared';
import { TokenRepository } from '@bitfi-mock-pmm/token';
import { ITypes, Router, Router__factory } from '@bitfi-mock-pmm/typechains';
import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TransferFactory } from './factories';
import { getMakePaymentHash } from './signatures/getInfoHash';
import getSignature, { SignatureType } from './signatures/getSignature';
import { SelectPMMEvent, SubmitSettlementTxResponse } from './types';
import { decodeAddress } from './utils';

@Processor('router-select-pmm-events')
export class SettlementProcessor {
  private contract: Router;
  private provider: ethers.JsonRpcProvider;
  private pmmWallet: ethers.Wallet;
  private pmmPrivateKey: string;

  private readonly logger = new Logger(SettlementProcessor.name);

  constructor(
    private configService: ConfigService,
    private tokenRepo: TokenRepository,
    private transferFactory: TransferFactory,
    @Inject('SOLVER_REQ_SERVICE')
    private readonly reqService: ReqService
  ) {
    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL');
    const contractAddress = this.configService.getOrThrow<string>(
      'ROUTER_CONTRACT_ADDRESS'
    );
    this.pmmPrivateKey =
      this.configService.getOrThrow<string>('PMM_PRIVATE_KEY');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    this.pmmWallet = new ethers.Wallet(this.pmmPrivateKey, this.provider);
    this.contract = Router__factory.connect(contractAddress, this.pmmWallet);
  }

  @Process('selectPMM')
  async handleSelectPMMEvent(job: Job<string>) {
    try {
      const { tradeId } = toObject(job.data) as SelectPMMEvent;

      const pMMSelection = await this.contract.getPMMSelection(tradeId);

      const { pmmInfo } = pMMSelection;

      const pmmId = toBeHex(this.pmmWallet.address, 32);
      if (pmmInfo.selectedPMMId !== pmmId) {
        this.logger.error(`Tradeid ${tradeId} is not belong this pmm`);
        return;
      }

      const trade: ITypes.TradeDataStructOutput =
        await this.contract.getTradeData(tradeId);

      const paymentTxHash = await this.transferToken(pmmInfo, trade);

      const signerAddress = await this.contract.SIGNER();
      const makePaymentInfoHash = getMakePaymentHash(paymentTxHash);
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
          tradeId: tradeId,
          pmmId: pmmId,
          settlementTx: paymentTxHash,
          signature: signature,
        },
      });

      this.logger.log(
        `response from solver for ${tradeId}: ${toString(response)}`
      );
      this.logger.log(`Processing selectPMM for trade ${tradeId} completed`);
    } catch (error) {
      this.logger.error(`Processing selectPMM event: ${error}`);
    }
  }

  private async transferToken(
    pmmInfo: { amountOut: bigint },
    trade: ITypes.TradeDataStructOutput
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
