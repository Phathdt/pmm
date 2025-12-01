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
  address: string
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
  max: number
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
  [key: string]: unknown
}
