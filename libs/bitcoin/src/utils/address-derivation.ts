import { config } from '@optimex-xyz/market-maker-sdk'

import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import * as ecc from 'tiny-secp256k1'

// Initialize ECC library for Bitcoin
bitcoin.initEccLib(ecc)

const ECPair = ECPairFactory(ecc)

export interface DeriveP2TRAddressOptions {
  /** WIF-encoded private key */
  privateKeyWIF: string
}

export interface DeriveP2TRAddressResult {
  /** Derived P2TR (Taproot) address */
  address: string
  /** Whether the WIF was converted from a different network */
  wasConverted: boolean
  /** Original network of the WIF key */
  originalNetwork: 'mainnet' | 'testnet'
}

/**
 * Derives a P2TR (Taproot) address from a WIF-encoded private key.
 * Handles network mismatch by converting keys between mainnet/testnet.
 *
 * @param options - Derivation options including private key and target network
 * @returns The derived P2TR address and metadata about the derivation
 * @throws Error if the private key format is invalid
 */
export function deriveP2TRAddress(options: DeriveP2TRAddressOptions): DeriveP2TRAddressResult {
  const { privateKeyWIF } = options
  const isTestnet = config.isTestnet()
  const targetNetwork = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin

  let keyPair: ReturnType<typeof ECPair.fromPrivateKey>
  let wasConverted = false
  let originalNetwork: 'mainnet' | 'testnet' = isTestnet ? 'testnet' : 'mainnet'

  try {
    // Try to decode with target network first
    keyPair = ECPair.fromWIF(privateKeyWIF, targetNetwork)
  } catch {
    // If failed, try to decode with opposite network and convert
    const oppositeNetwork = isTestnet ? bitcoin.networks.bitcoin : bitcoin.networks.testnet

    try {
      const tempKeyPair = ECPair.fromWIF(privateKeyWIF, oppositeNetwork)
      // Convert to target network
      keyPair = ECPair.fromPrivateKey(tempKeyPair.privateKey!, { network: targetNetwork })
      wasConverted = true
      originalNetwork = isTestnet ? 'mainnet' : 'testnet'
    } catch (innerError) {
      throw new Error(`Invalid BTC private key format: ${(innerError as Error).message}`)
    }
  }

  // Derive P2TR (Taproot) address using x-only public key (32 bytes, without prefix)
  const p2tr = bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(keyPair.publicKey.slice(1, 33)),
    network: targetNetwork,
  })

  if (!p2tr.address) {
    throw new Error('Failed to derive P2TR address')
  }

  return {
    address: p2tr.address,
    wasConverted,
    originalNetwork,
  }
}
