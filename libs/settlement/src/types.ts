export interface SubmitSettlementEvent {
  tradeId: string
  paymentTxId: string
}

export interface TransferSettlementEvent {
  tradeId: string
}
