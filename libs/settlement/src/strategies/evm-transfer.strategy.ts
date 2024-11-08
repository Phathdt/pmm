import { ethers } from 'ethers';

import { ERC20__factory } from '@bitfi-mock-pmm/typechains';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ITransferStrategy,
  TransferParams,
} from '../interfaces/transfer-strategy.interface';

@Injectable()
export class EVMTransferStrategy implements ITransferStrategy {
  private pmmPrivateKey: string;
  private readonly logger = new Logger(EVMTransferStrategy.name);

  private readonly rpcMap = new Map<string, string>([
    ['base-sepolia', 'https://base-sepolia.blockpi.network/v1/rpc/public'],
    ['base-mainnet', 'https://base.blockpi.network/v1/rpc/public'],
  ]);

  constructor(private configService: ConfigService) {
    this.pmmPrivateKey = this.configService.getOrThrow<string>(
      'PMM_EVM_PRIVATE_KEY'
    );
  }

  async transfer(params: TransferParams): Promise<string> {
    const { toAddress, amount, token } = params;
    const { tokenAddress, networkId } = token;

    const signer = this.getSigner(networkId);

    try {
      let tx: ethers.TransactionResponse;

      if (tokenAddress === 'native') {
        tx = await signer.sendTransaction({
          to: toAddress,
          value: amount,
          gasLimit: 21000,
        });
      } else {
        const tokenContract = ERC20__factory.connect(tokenAddress, signer);
        const estimatedGas = await tokenContract.transfer.estimateGas(
          toAddress,
          amount
        );

        tx = await tokenContract.transfer(toAddress, amount, {
          gasLimit: (estimatedGas * BigInt(120)) / BigInt(100),
        });
      }

      await tx.wait();

      return tx.hash;
    } catch (error) {
      this.logger.error('EVM transfer failed:', error);
      throw error;
    }
  }

  private getSigner(networkId: string): ethers.Wallet {
    const rpcUrl = this.rpcMap.get(networkId);
    if (!rpcUrl) {
      throw new Error(`Unsupported networkId: ${networkId}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    return new ethers.Wallet(this.pmmPrivateKey, provider);
  }
}
