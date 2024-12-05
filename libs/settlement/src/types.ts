export interface SubmitSettlementEvent {
  tradeId: string;
  paymentTxId: string;
}

export interface TransferSettlementEvent {
  tradeId: string;
}

export interface SubmitSettlementTxResponse {
  tradeId: string;
  status: string;
  error: string;
}

export const SUBMIT_SETTLEMENT_QUEUE = 'submit_settlement_queue';
export const TRANSFER_SETTLEMENT_QUEUE = 'transfer_settlement_queue';
