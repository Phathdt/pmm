import { config } from '@optimex-xyz/market-maker-sdk'

import { ethers } from 'ethers'

import { CustomConfigService } from './custom-config.service'

export const getProvider = (configService: CustomConfigService): ethers.JsonRpcProvider => {
  const rpcUrl = config.isTestnet() ? configService.rpc.ethSepoliaUrl : configService.rpc.ethUrl

  return new ethers.JsonRpcProvider(rpcUrl)
}
