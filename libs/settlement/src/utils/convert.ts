import { ensureHexPrefix } from '@bitfi-mock-pmm/shared'
import { Token } from '@petafixyz/market-maker-sdk'
import { toUtf8Bytes, toUtf8String } from 'ethers'
import { ethers } from 'ethers'

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

export const l2Encode = (info: string) => {
  if (/^0x[0-9a-fA-F]*$/.test(info)) {
    return info
  }

  return ensureHexPrefix(ethers.hexlify(toUtf8Bytes(info)))
}

export const l2Decode = (info: string) => {
  try {
    return toUtf8String(info)
  } catch {
    return info
  }
}
