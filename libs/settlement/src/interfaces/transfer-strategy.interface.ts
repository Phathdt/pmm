import { Token } from '@bitfi-mock-pmm/token';

export interface TransferParams {
  toAddress: string;
  amount: bigint;
  token: Token;
}

export interface ITransferStrategy {
  transfer(params: TransferParams): Promise<string>;
}
