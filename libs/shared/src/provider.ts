import { ethers } from 'ethers'

import { ETHEREUM, ETHEREUM_SEPOLIA } from './constants'

export const getRpcUrlByNetworkId = (networkId: string): string => {
  const rpcUrl = (() => {
    switch (networkId) {
      case ETHEREUM:
        return process.env['ETH_RPC_URL']
      case ETHEREUM_SEPOLIA:
        return process.env['ETH_SEPOLIA_RPC_URL']
      default:
        throw new Error(`Network ID ${networkId} not supported`)
    }
  })()

  if (!rpcUrl) {
    throw new Error(`RPC URL for network ID ${networkId} not found`)
  }

  return rpcUrl
}

export const getProvider = (networkId: string) => {
  const rpcUrl = getRpcUrlByNetworkId(networkId)

  return new ethers.JsonRpcProvider(rpcUrl)
}
