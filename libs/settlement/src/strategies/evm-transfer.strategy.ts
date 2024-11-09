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

  private readonly DEFAULT_NATIVE_TRANSFER_GAS = 21000n;
  private readonly GAS_BUFFER_PERCENTAGE = 120;

  constructor(private configService: ConfigService) {
    this.pmmPrivateKey = this.configService.getOrThrow<string>(
      'PMM_EVM_PRIVATE_KEY'
    );
  }

  async transfer(params: TransferParams): Promise<string> {
    const { toAddress, amount, token } = params;
    const { tokenAddress, networkId } = token;

    const { signer, provider } = this.getSigner(networkId);

    try {
      let tx: ethers.TransactionResponse;
      const feeData = await provider.getFeeData();

      if (tokenAddress === 'native') {
        const estimatedGas = await this.estimateGasForNativeTransfer(
          signer,
          provider,
          toAddress,
          amount
        );

        const baseTxParams = {
          to: toAddress,
          value: amount,
          gasLimit: estimatedGas,
        };

        let txRequest: ethers.TransactionRequest;

        if (feeData.maxFeePerGas) {
          txRequest = {
            ...baseTxParams,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          };
        } else {
          txRequest = {
            ...baseTxParams,
            gasPrice: feeData.gasPrice,
          };
        }

        tx = await signer.sendTransaction(txRequest);
      } else {
        const tokenContract = ERC20__factory.connect(tokenAddress, signer);
        const estimatedGas = await tokenContract.transfer.estimateGas(
          toAddress,
          amount
        );

        const baseTxParams = {
          gasLimit: this.addGasBuffer(estimatedGas),
        };

        let txParams: ethers.TransactionRequest;

        if (feeData.maxFeePerGas) {
          txParams = {
            ...baseTxParams,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
          };
        } else {
          txParams = {
            ...baseTxParams,
            gasPrice: feeData.gasPrice,
          };
        }

        tx = await tokenContract.transfer(toAddress, amount, txParams);
      }

      await tx.wait();

      return tx.hash;
    } catch (error) {
      this.logger.error('EVM transfer failed:', error);
      throw error;
    }
  }

  private async estimateGasForNativeTransfer(
    signer: ethers.Wallet,
    provider: ethers.Provider,
    to: string,
    value: bigint
  ): Promise<bigint> {
    try {
      const estimatedGas = await provider.estimateGas({
        from: signer.address,
        to,
        value,
      });

      const baseGas =
        estimatedGas > this.DEFAULT_NATIVE_TRANSFER_GAS
          ? estimatedGas
          : this.DEFAULT_NATIVE_TRANSFER_GAS;

      return this.addGasBuffer(baseGas);
    } catch (error) {
      this.logger.warn('Gas estimation failed, using default value:', error);
      return this.addGasBuffer(this.DEFAULT_NATIVE_TRANSFER_GAS);
    }
  }

  private addGasBuffer(gas: bigint): bigint {
    return (gas * BigInt(this.GAS_BUFFER_PERCENTAGE)) / BigInt(100);
  }

  private getSigner(networkId: string): {
    signer: ethers.Wallet;
    provider: ethers.Provider;
  } {
    const rpcUrl = this.rpcMap.get(networkId);
    if (!rpcUrl) {
      throw new Error(`Unsupported networkId: ${networkId}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(this.pmmPrivateKey, provider);

    return { signer, provider };
  }
}
