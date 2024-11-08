export interface SelectPMMEvent {
  tradeId: string;
}

export interface SubmitSettlementTxResponse {
  tradeId: string;
  status: string;
  error: string;
}
