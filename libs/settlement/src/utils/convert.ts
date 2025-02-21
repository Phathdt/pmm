import { ethers } from 'ethers'

import { removeHexPrefix } from '@bitfi-mock-pmm/shared'
import { Token } from '@petafixyz/market-maker-sdk'

export const encodeAddress = (address: string, token: Token) => {
  switch (token.networkType.toUpperCase()) {
    case 'EVM':
      return ethers.hexlify(address)
    case 'BTC':
    case 'TBTC':
    case 'SOLANA':
      return ethers.toUtf8Bytes(address)
    default:
      throw new Error(`Unsupported network: ${token.networkType}`)
  }
}

export const decodeAddress = (value: string, token: Token) => {
  switch (token.networkType.toUpperCase()) {
    case 'EVM':
      return ethers.getAddress(value)
    case 'BTC':
    case 'TBTC':
    case 'SOLANA':
      return ethers.toUtf8String(value)
    default:
      throw new Error(`Unsupported network: ${token.networkType}`)
  }
}

export const convertToHexString = (input: string): string => {
  if (ethers.isHexString(input)) {
    return input
  }

  input = removeHexPrefix(input)

  return ethers.hexlify(ethers.toUtf8Bytes(input))
}

export const decodeFromHexString = (input: string): string => {
  if (input.startsWith('0x')) {
    if (input.length === 34 || input.length === 66) {
      return input
    }

    return ethers.toUtf8String(input)
  }

  return ethers.toUtf8String(input)
}
