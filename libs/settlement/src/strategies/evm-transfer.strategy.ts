import { ethers, ZeroAddress } from 'ethers';

import {
  ensureHexPrefix,
  Payment__factory,
  Router,
  Router__factory,
} from '@bitfixyz/market-maker-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ITransferStrategy,
  TransferParams,
} from '../interfaces/transfer-strategy.interface';

@Injectable()
export class EVMTransferStrategy implements ITransferStrategy {
  private pmmPrivateKey: string;
  private contract: Router;
  private readonly logger = new Logger(EVMTransferStrategy.name);

  private readonly rpcMap = new Map<string, string>([
    ['ethereum', 'https://eth-mainnet.public.blastapi.io'],
    ['ethereum-sepolia', 'https://eth-sepolia.public.blastapi.io'],
    ['base-sepolia', 'https://base-sepolia.public.blastapi.io'],
  ]);

  private readonly paymentAddressMap = new Map<string, string>([
    ['ethereum', '0x5d933b2cb3a0DE221F079B450d73e6B9e35272f0'],
    ['ethereum-sepolia', '0x1F0984852E1aFE19Cf31309c988ed0423A7408A4'],
    ['base-sepolia', '0x05E12AbdC28BB9AC75Fd1f21B424bebB28b39693'],
  ]);

  constructor(private configService: ConfigService) {
    this.pmmPrivateKey = this.configService.getOrThrow<string>(
      'PMM_EVM_PRIVATE_KEY'
    );

    const rpcUrl = this.configService.getOrThrow<string>('RPC_URL');
    const contractAddress =
      this.configService.getOrThrow<string>('ROUTER_ADDRESS');

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    this.contract = Router__factory.connect(contractAddress, provider);
  }

  async transfer(params: TransferParams): Promise<string> {
    const { toAddress, amount, token, tradeId } = params;
    const { tokenAddress, networkId } = token;

    const signer = this.getSigner(networkId);

    const paymentContract = this.getPaymentContract(networkId, signer);

    const protocolFee = await this.contract.getProtocolFee(tradeId);

    const tx = await paymentContract.payment(
      tradeId,
      tokenAddress === 'native' ? ZeroAddress : tokenAddress,
      toAddress,
      amount,
      protocolFee.amount,
      {
        value: tokenAddress === 'native' ? amount : 0n,
      }
    );

    this.logger.log(`Transfer transaction sent: ${tx.hash}`);

    return ensureHexPrefix(tx.hash);
  }

  private getSigner(networkId: string) {
    const rpcUrl = this.rpcMap.get(networkId);
    if (!rpcUrl) {
      throw new Error(`Unsupported networkId: ${networkId}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Wallet(this.pmmPrivateKey, provider);
  }

  private getPaymentContract(networkId: string, signer: ethers.Wallet) {
    const paymentAddress = this.paymentAddressMap.get(networkId);
    if (!paymentAddress) {
      throw new Error(`Unsupported networkId: ${networkId}`);
    }

    return Payment__factory.connect(paymentAddress, signer);
  }
}
