import { Injectable } from '@nestjs/common'
import { CustomConfigService, getProvider } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'

import { ethers } from 'ethers'

import { INonceManagerService } from '../../domain'

/**
 * Service for managing transaction nonces across different networks
 * Provides thread-safe nonce management using ethers.js NonceManager
 */
@Injectable()
export class NonceManagerService implements INonceManagerService {
  private readonly logger: EnhancedLogger
  private readonly nonceManagers = new Map<string, ethers.NonceManager>()
  private readonly pmmPrivateKey: string

  constructor(
    private readonly configService: CustomConfigService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: NonceManagerService.name })
    this.pmmPrivateKey = this.configService.pmm.evm.privateKey
  }

  /**
   * Get a NonceManager for the specified network using PMM private key
   * Creates and caches NonceManager instances per network
   */
  getNonceManager(networkId: string): ethers.NonceManager {
    const cacheKey = `${networkId}-pmm`

    if (!this.nonceManagers.has(cacheKey)) {
      const provider = getProvider(this.configService)
      const wallet = new ethers.Wallet(this.pmmPrivateKey, provider)
      const nonceManager = new ethers.NonceManager(wallet)

      this.nonceManagers.set(cacheKey, nonceManager)
      this.logger.log({
        message: 'NonceManager created for network',
        networkId,
        cacheKey,
        operation: 'nonce_manager_creation',
        timestamp: new Date().toISOString(),
      })
    }

    const nonceManager = this.nonceManagers.get(cacheKey)
    if (!nonceManager) {
      throw new Error(`NonceManager not found for cache key: ${cacheKey}`)
    }
    return nonceManager
  }

  /**
   * Get the current nonce for PMM wallet on a specific network
   */
  async getCurrentNonce(networkId: string): Promise<number> {
    const nonceManager = this.getNonceManager(networkId)
    const nonce = await nonceManager.getNonce()
    this.logger.log({
      message: 'Current nonce retrieved for network',
      networkId,
      nonce,
      operation: 'nonce_retrieval',
      timestamp: new Date().toISOString(),
    })
    return nonce
  }

  /**
   * Reset the nonce manager cache for a specific network
   * Useful when transactions fail and nonce tracking needs to be refreshed
   */
  resetNonceManager(networkId: string): void {
    const cacheKey = `${networkId}-pmm`
    this.nonceManagers.delete(cacheKey)
    this.logger.log({
      message: 'NonceManager reset for network',
      networkId,
      cacheKey,
      operation: 'nonce_manager_reset',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Clear all cached nonce managers
   */
  clearAllNonceManagers(): void {
    this.nonceManagers.clear()
    this.logger.log({
      message: 'All NonceManagers cleared',
      operation: 'nonce_manager_clear_all',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Refresh nonce managers for all cached networks
   * This forces a fresh nonce fetch from the network
   */
  async refreshAllNonces(): Promise<void> {
    const refreshPromises: Promise<void>[] = []

    for (const [cacheKey, nonceManager] of this.nonceManagers.entries()) {
      refreshPromises.push(
        (async () => {
          try {
            const newNonce = await nonceManager.getNonce()
            this.logger.log({
              message: 'Nonce refreshed for cache key',
              cacheKey,
              newNonce,
              operation: 'nonce_refresh',
              status: 'success',
              timestamp: new Date().toISOString(),
            })
          } catch (error: unknown) {
            this.logger.warn({
              message: 'Failed to refresh nonce for cache key',
              cacheKey,
              error: error instanceof Error ? error.message : String(error),
              operation: 'nonce_refresh',
              status: 'failed',
              timestamp: new Date().toISOString(),
            })
          }
        })()
      )
    }

    await Promise.all(refreshPromises)
    this.logger.log({
      message: 'Nonces refreshed for all cached networks',
      cachedNetworksCount: this.nonceManagers.size,
      operation: 'nonce_refresh_all',
      status: 'completed',
      timestamp: new Date().toISOString(),
    })
  }
}
