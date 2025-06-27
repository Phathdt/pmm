import { PublicKey } from '@solana/web3.js'

import * as bitcoinjs from 'bitcoinjs-lib'
import { isAddress } from 'ethers'

export function isSameAddress(address1: string, address2: string): boolean {
  if (!address1 || !address2) {
    return false
  }

  const standardAddr1 = standardizeAddress(address1)
  const standardAddr2 = standardizeAddress(address2)

  return standardAddr1 === standardAddr2
}

export function standardizeAddress(address: string): string {
  if (!address) {
    return address
  }

  const trimmed = address.trim()

  if (isEvmAddress(trimmed)) {
    return trimmed.toLowerCase()
  }

  if (isBitcoinAddress(trimmed)) {
    return trimmed.toLowerCase()
  }

  if (isSolanaAddress(trimmed)) {
    return trimmed
  }

  return trimmed
}

function isEvmAddress(address: string): boolean {
  return isAddress(address)
}

export function isBitcoinAddress(address: string): boolean {
  try {
    bitcoinjs.address.toOutputScript(address, bitcoinjs.networks.bitcoin)
    return true
  } catch {
    // Ignore mainnet validation error, try testnet
  }

  try {
    bitcoinjs.address.toOutputScript(address, bitcoinjs.networks.testnet)
    return true
  } catch {
    return false
  }
}

function isSolanaAddress(address: string): boolean {
  try {
    const publicKey = new PublicKey(address)
    return PublicKey.isOnCurve(publicKey.toBytes())
  } catch {
    return false
  }
}

export function truncateAddress(address: string): string {
  if (!address) {
    return address
  }

  const trimmed = address.trim()

  if (trimmed.length <= 8) {
    return trimmed
  }

  if (trimmed.startsWith('0x')) {
    const addressBody = trimmed.slice(2)
    if (addressBody.length <= 8) {
      return trimmed
    }
    const start = addressBody.slice(0, 4)
    const end = addressBody.slice(-4)
    return `0x${start}...${end}`
  }

  const start = trimmed.slice(0, 4)
  const end = trimmed.slice(-4)

  return `${start}...${end}`
}
