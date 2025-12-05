import * as fs from 'fs'
import * as path from 'path'
import { Injectable, Logger } from '@nestjs/common'

import * as yaml from 'js-yaml'

import { AppConfig } from './config.interface'
import { camelToSnakeCase, convertToCamelCase } from './utils'

@Injectable()
export class CustomConfigService {
  private readonly logger = new Logger(CustomConfigService.name)
  private _config!: AppConfig
  private proxyCache = new WeakMap<object, object>()

  constructor() {
    this.loadConfig()
    this.createPropertyAccessors()
    this.validateConfig()
  }

  private createPropertyAccessors(): void {
    this.createPropertiesRecursive(
      this as unknown as Record<string, unknown>,
      this._config as unknown as Record<string, unknown>
    )
  }

  private createPropertiesRecursive(target: Record<string, unknown>, source: Record<string, unknown>): void {
    const keys = Object.keys(source)

    keys.forEach((key) => {
      const value = source[key]

      if (Object.prototype.hasOwnProperty.call(target, key)) {
        return
      }

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.defineProperty(target, key, {
          get: () => {
            const currentValue = source[key] as object

            let cachedProxy = this.proxyCache.get(currentValue)
            if (!cachedProxy) {
              const proxy: Record<string, unknown> = {}
              this.createPropertiesRecursive(proxy, currentValue as Record<string, unknown>)
              this.proxyCache.set(currentValue, proxy)
              cachedProxy = proxy
            }

            return cachedProxy
          },
          enumerable: true,
          configurable: false,
        })
      } else {
        Object.defineProperty(target, key, {
          get: () => source[key],
          enumerable: true,
          configurable: false,
        })
      }
    })
  }

  private findProjectRoot(): string {
    let currentDir = process.cwd()
    while (currentDir !== path.dirname(currentDir)) {
      if (
        fs.existsSync(path.join(currentDir, 'config')) &&
        fs.existsSync(path.join(currentDir, 'package.json')) &&
        fs.existsSync(path.join(currentDir, 'yarn.lock'))
      ) {
        return currentDir
      }
      currentDir = path.dirname(currentDir)
    }
    return process.cwd()
  }

  private loadConfig(): void {
    try {
      const env = process.env['APP_ENV'] || 'local'
      const configFileName = `${env}.yaml`
      const projectRoot = this.findProjectRoot()
      const configPath = path.join(projectRoot, 'config', configFileName)

      if (!fs.existsSync(configPath)) {
        throw new Error(
          `Configuration file not found at ${configPath}. ` +
            `Please ensure config/${configFileName} exists. ` +
            `APP_ENV must be one of: local, development, staging, production`
        )
      }

      const fileContents = fs.readFileSync(configPath, 'utf8')
      const rawConfig = yaml.load(fileContents) as Record<string, unknown>

      if (!rawConfig || typeof rawConfig !== 'object') {
        throw new Error('Invalid YAML configuration format: expected an object')
      }

      this._config = convertToCamelCase(rawConfig) as AppConfig
      this.overrideWithEnv(this._config as unknown as Record<string, unknown>)

      this.logger.log(`Configuration loaded successfully from ${path.basename(configPath)} (APP_ENV=${env})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to load configuration: ${message}`)
      throw new Error(`Failed to load configuration: ${message}`)
    }
  }

  private overrideWithEnv(obj: Record<string, unknown>, prefix: string = ''): void {
    for (const key in obj) {
      const snakeKey = camelToSnakeCase(key).toUpperCase()
      const envKey = prefix ? `${prefix}__${snakeKey}` : snakeKey
      const value = obj[key]

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.overrideWithEnv(value as Record<string, unknown>, envKey)
      } else {
        const envValue = process.env[envKey]
        if (envValue !== undefined) {
          const parsed = this.parseEnvValue(envValue, value)
          obj[key] = parsed
        }
      }
    }
  }

  private parseEnvValue(envValue: string, originalValue: unknown): unknown {
    if (originalValue === null || originalValue === undefined) {
      return envValue
    }

    if (Array.isArray(originalValue)) {
      if (!envValue || envValue.trim() === '') {
        return []
      }
      return envValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }

    const originalType = typeof originalValue
    switch (originalType) {
      case 'number':
        return Number(envValue)
      case 'boolean':
        return envValue.toLowerCase() === 'true'
      default:
        return envValue
    }
  }

  private validateConfig(): void {
    const errors: string[] = []

    const isPlaceholder = (value: unknown): boolean => {
      return value === 'replace_me' || value === '' || value === null || value === undefined
    }

    if (isPlaceholder(this._config.database?.url)) {
      errors.push('database.url must be configured')
    }

    if (!this._config.host?.port || this._config.host.port <= 0) {
      errors.push('host.port must be a positive number')
    }

    if (isPlaceholder(this._config.redis?.url)) {
      errors.push('redis.url must be configured')
    }

    // Rebalance configuration validation (only when enabled)
    if (this._config.rebalance?.enabled) {
      if (isPlaceholder(this._config.rebalance.near?.baseUrl)) {
        errors.push('rebalance.near.baseUrl must be configured when rebalancing is enabled')
      }

      if (isPlaceholder(this._config.rebalance.near?.apiKey)) {
        errors.push('rebalance.near.apiKey must be configured when rebalancing is enabled')
      }

      const slippageThreshold = this._config.rebalance.slippage?.thresholdBps
      if (slippageThreshold !== undefined && (slippageThreshold < 0 || slippageThreshold > 10000)) {
        errors.push('rebalance.slippage.thresholdBps must be between 0 and 10000')
      }

      const maxRetryDuration = this._config.rebalance.timing?.maxRetryDurationHours
      if (maxRetryDuration !== undefined && maxRetryDuration < 1) {
        errors.push('rebalance.timing.maxRetryDurationHours must be at least 1')
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
      this.logger.error(errorMessage)
      throw new Error(errorMessage)
    }

    this.logger.log('Configuration validation passed')
  }

  get<T = unknown>(key: string): T {
    const keys = key.split('.')
    let value: unknown = this._config
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k]
      } else {
        return undefined as T
      }
    }
    return value as T
  }
}

export interface CustomConfigService extends AppConfig {}
