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
  // Mutex locks to prevent race conditions during nonce reset
  private readonly nonceLocks = new Map<string, Promise<number>>()

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
   * This resets cached NonceManagers and syncs fresh nonces from network
   */
  async refreshAllNonces(): Promise<void> {
    // Get all cached network IDs before clearing
    const networkIds: string[] = []
    for (const cacheKey of this.nonceManagers.keys()) {
      // Extract networkId from cacheKey (format: "networkId-pmm")
      const networkId = cacheKey.replace('-pmm', '')
      networkIds.push(networkId)
    }

    if (networkIds.length === 0) {
      this.logger.log({
        message: 'No cached nonce managers to refresh',
        operation: 'nonce_refresh_all',
        status: 'skipped',
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Reset and sync each network
    const refreshPromises = networkIds.map(async (networkId) => {
      try {
        const newNonce = await this.handleNonceError(networkId)
        this.logger.log({
          message: 'Nonce synced from network',
          networkId,
          newNonce,
          operation: 'nonce_refresh',
          status: 'success',
          timestamp: new Date().toISOString(),
        })
      } catch (error: unknown) {
        this.logger.warn({
          message: 'Failed to sync nonce from network',
          networkId,
          error: error instanceof Error ? error.message : String(error),
          operation: 'nonce_refresh',
          status: 'failed',
          timestamp: new Date().toISOString(),
        })
      }
    })

    await Promise.all(refreshPromises)
    this.logger.log({
      message: 'Nonces synced from network for all cached networks',
      networksCount: networkIds.length,
      operation: 'nonce_refresh_all',
      status: 'completed',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Handle nonce error by resetting and syncing to network's latest nonce
   * This destroys the cached NonceManager and creates a fresh one
   * Uses mutex to prevent race conditions when multiple transactions fail simultaneously
   * @param networkId Network that had the nonce error
   * @returns The new synced nonce from the network
   */
  async handleNonceError(networkId: string): Promise<number> {
    const cacheKey = `${networkId}-pmm`

    // Check if there's already a nonce reset in progress for this network
    const existingLock = this.nonceLocks.get(cacheKey)
    if (existingLock) {
      this.logger.log({
        message: 'Nonce reset already in progress, waiting for completion',
        networkId,
        cacheKey,
        operation: 'nonce_error_handling',
        status: 'waiting',
        timestamp: new Date().toISOString(),
      })
      return existingLock
    }

    // Create a new lock and execute the reset
    const resetPromise = this.executeNonceReset(networkId, cacheKey)
    this.nonceLocks.set(cacheKey, resetPromise)

    try {
      const result = await resetPromise
      return result
    } finally {
      // Clean up the lock after completion
      this.nonceLocks.delete(cacheKey)
    }
  }

  /**
   * Execute the actual nonce reset logic
   * @param networkId Network that had the nonce error
   * @param cacheKey Cache key for the network
   * @returns The new synced nonce from the network
   */
  private async executeNonceReset(networkId: string, cacheKey: string): Promise<number> {
    this.logger.warn({
      message: 'Handling nonce error - resetting NonceManager',
      networkId,
      cacheKey,
      operation: 'nonce_error_handling',
      timestamp: new Date().toISOString(),
    })

    // Delete the cached NonceManager to force fresh creation
    this.nonceManagers.delete(cacheKey)

    // Create a fresh NonceManager and get the latest nonce from network
    const newNonceManager = this.getNonceManager(networkId)

    // Force sync with network by getting transaction count directly
    const provider = newNonceManager.provider
    if (!provider) {
      throw new Error(`Provider not available for network ${networkId}`)
    }

    const walletAddress = await newNonceManager.getAddress()
    const networkNonce = await provider.getTransactionCount(walletAddress, 'pending')

    this.logger.log({
      message: 'Nonce synced from network after error',
      networkId,
      cacheKey,
      syncedNonce: networkNonce,
      operation: 'nonce_error_handling',
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    return networkNonce
  }
}
