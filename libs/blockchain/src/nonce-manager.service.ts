import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { getProvider } from '@optimex-pmm/shared'

import { ethers } from 'ethers'

/**
 * Service for managing transaction nonces across different networks
 * Provides thread-safe nonce management using ethers.js NonceManager
 */
@Injectable()
export class NonceManagerService {
  private readonly logger = new Logger(NonceManagerService.name)
  private readonly nonceManagers = new Map<string, ethers.NonceManager>()
  private readonly pmmPrivateKey: string

  constructor(private readonly configService: ConfigService) {
    this.pmmPrivateKey = this.configService.getOrThrow<string>('PMM_EVM_PRIVATE_KEY')
  }

  /**
   * Get a NonceManager for the specified network using PMM private key
   * Creates and caches NonceManager instances per network
   */
  getNonceManager(networkId: string): ethers.NonceManager {
    const cacheKey = `${networkId}-pmm`

    if (!this.nonceManagers.has(cacheKey)) {
      const provider = getProvider(networkId)
      const wallet = new ethers.Wallet(this.pmmPrivateKey, provider)
      const nonceManager = new ethers.NonceManager(wallet)

      this.nonceManagers.set(cacheKey, nonceManager)
      this.logger.log(`Created NonceManager for network ${networkId}`)
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
    this.logger.log(`Current nonce for network ${networkId}: ${nonce}`)
    return nonce
  }

  /**
   * Reset the nonce manager cache for a specific network
   * Useful when transactions fail and nonce tracking needs to be refreshed
   */
  resetNonceManager(networkId: string): void {
    const cacheKey = `${networkId}-pmm`
    this.nonceManagers.delete(cacheKey)
    this.logger.log(`Reset NonceManager for network ${networkId}`)
  }

  /**
   * Clear all cached nonce managers
   */
  clearAllNonceManagers(): void {
    this.nonceManagers.clear()
    this.logger.log('Cleared all NonceManagers')
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
            this.logger.log(`Refreshed nonce for cache key: ${cacheKey}, new nonce: ${newNonce}`)
          } catch (error) {
            this.logger.warn(`Failed to refresh nonce for cache key ${cacheKey}:`, error)
          }
        })()
      )
    }

    await Promise.all(refreshPromises)
    this.logger.log(`Refreshed nonces for ${this.nonceManagers.size} cached networks`)
  }
}
