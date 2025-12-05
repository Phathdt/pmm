import { FeeEstimates, TransactionResponse, Utxo } from '../schemas'

export interface SendBtcParams {
  /** Recipient address */
  toAddress: string
  /** Amount in satoshis */
  amount: bigint
  /** Optional OP_RETURN data (hex without 0x prefix, max 80 bytes) */
  opReturnData?: string
}

export interface SendBtcResult {
  /** Transaction ID */
  txId: string
  /** Fee paid in satoshis */
  feeSats: bigint
}

export interface IBitcoinService {
  // Transaction operations
  broadcast(txHex: string): Promise<string>
  getTransaction(txId: string): Promise<TransactionResponse | null>

  // Address operations
  getUtxos(address: string): Promise<Utxo[]>
  getBalance(address: string): Promise<bigint>

  // Fee operations
  getFeeEstimates(): Promise<FeeEstimates>
  getRecommendedFeeRate(): Promise<number>

  // Transfer operations
  sendBtc(params: SendBtcParams): Promise<SendBtcResult>
}
