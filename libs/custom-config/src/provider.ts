import { ethers } from 'ethers'

import { CustomConfigService } from './custom-config.service'

const ETHEREUM = 'ethereum'
const ETHEREUM_SEPOLIA = 'ethereum_sepolia'

export const getEthRpcUrlByNetworkId = (configService: CustomConfigService, networkId: string): string => {
  switch (networkId) {
    case ETHEREUM:
      return configService.rpc.ethUrl
    case ETHEREUM_SEPOLIA:
      return configService.rpc.ethSepoliaUrl
    default:
      throw new Error(`Network ID ${networkId} not supported`)
  }
}

export const getEthProvider = (configService: CustomConfigService, networkId: string): ethers.JsonRpcProvider => {
  const rpcUrl = getEthRpcUrlByNetworkId(configService, networkId)

  return new ethers.JsonRpcProvider(rpcUrl)
}
