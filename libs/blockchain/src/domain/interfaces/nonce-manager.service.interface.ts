import { ethers } from 'ethers'

export interface INonceManagerService {
  /**
   * Get a NonceManager for the specified network using PMM private key
   * Creates and caches NonceManager instances per network
   */
  getNonceManager(networkId: string): ethers.NonceManager

  /**
   * Get the current nonce for PMM wallet on a specific network
   */
  getCurrentNonce(networkId: string): Promise<number>

  /**
   * Reset the nonce manager cache for a specific network
   * Useful when transactions fail and nonce tracking needs to be refreshed
   */
  resetNonceManager(networkId: string): void

  /**
   * Clear all cached nonce managers
   */
  clearAllNonceManagers(): void

  /**
   * Refresh nonce managers for all cached networks
   * This forces a fresh nonce fetch from the network
   */
  refreshAllNonces(): Promise<void>
}
