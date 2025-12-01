export interface QuoteSession {
  fromToken: string
  toToken: string
  amount: string
  pmmReceivingAddress: string
  indicativeQuote: string
  timestamp: number
}

export type QuoteSessionCreateData = Omit<QuoteSession, 'timestamp'>
