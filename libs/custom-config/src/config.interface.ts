export interface DatabaseConfig {
  url: string
}

export interface RedisConfig {
  url: string
}

export interface HostConfig {
  port: number
}

export interface LogConfig {
  level: string
  enableJsonFormat: boolean
}

export interface SolanaConfig {
  privateKey: string
  address: string
}

export interface EvmConfig {
  privateKey: string
  address: string
}

export interface BtcConfig {
  privateKey: string
  maxFeeRate: number
}

export interface PmmConfig {
  id: string
  privateKey: string
  evm: EvmConfig
  btc: BtcConfig
  solana: SolanaConfig
}

export interface TradeConfig {
  min: number
  softCap: number
  hardCap: number
  commitmentBps: number
  indicativeBps: number
  onlySolana: boolean
  minBalanceUsd: number
}

export interface QuoteConfig {
  sessionTimeout: number
}

export interface IpWhitelistConfig {
  enabled: boolean
  list: string[]
}

export interface TelegramConfig {
  botToken: string
  chatId: string
  baseUrl: string
  timeout: number
}

export interface RpcConfig {
  optimexUrl: string
  ethUrl: string
  ethSepoliaUrl: string
  solanaUrl: string
}

// Rebalancing configuration interfaces
export interface NearConfig {
  baseUrl: string
  apiKey: string // JWT Bearer token
  // Swap configuration (recipient & refundTo derived from pmm.evm.address and pmm.btc.privateKey)
  slippageToleranceBps: number // Slippage tolerance in basis points (e.g., 500 = 5%)
  referral: string // Referral code (optional, e.g., "optimex")
  // Asset configuration
  originAsset: string // Origin asset ID (e.g., "nep141:btc.omft.near")
  destinationAsset: string // Destination asset ID (e.g., "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near")
}

export interface RebalanceTimingConfig {
  maxRetryDurationHours: number
}

export interface RebalanceSlippageConfig {
  thresholdBps: number
  highWarningBps: number
}

export interface RebalanceConfig {
  enabled: boolean
  timing: RebalanceTimingConfig
  slippage: RebalanceSlippageConfig
  near: NearConfig
}

export interface BitcoinConfig {
  timeoutMs: number
  maxRetries: number
  retryDelayMs: number
  skipConfirm: boolean
}

export interface AppConfig {
  host: HostConfig
  database: DatabaseConfig
  redis: RedisConfig
  log: LogConfig
  rpc: RpcConfig
  pmm: PmmConfig
  trade: TradeConfig
  quote: QuoteConfig
  ipWhitelist: IpWhitelistConfig
  telegram: TelegramConfig
  rebalance: RebalanceConfig
  bitcoin: BitcoinConfig
  [key: string]: unknown
}
