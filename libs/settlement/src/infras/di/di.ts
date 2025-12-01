// Symbol-based dependency injection tokens for better type safety
export const SETTLEMENT_SERVICE = Symbol('SETTLEMENT_SERVICE')
export const TRANSFER_FACTORY = Symbol('TRANSFER_FACTORY')

// Strategy tokens (for potential future direct injection)
export const EVM_TRANSFER_STRATEGY = Symbol('EVM_TRANSFER_STRATEGY')
export const EVM_LIQUIDATION_TRANSFER_STRATEGY = Symbol('EVM_LIQUIDATION_TRANSFER_STRATEGY')
export const BTC_TRANSFER_STRATEGY = Symbol('BTC_TRANSFER_STRATEGY')
export const SOLANA_TRANSFER_STRATEGY = Symbol('SOLANA_TRANSFER_STRATEGY')
