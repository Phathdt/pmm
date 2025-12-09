import { MorphoLiquidationGateway__factory, Payment__factory } from '@optimex-xyz/market-maker-sdk'

import { ErrorDecoder } from 'ethers-decode-error'

import { OptimexLiquidator__factory } from '../contracts'

// Filter only error entries from ABI
type AbiItem = { type?: string }
const filterErrors = (abi: readonly AbiItem[]): AbiItem[] => {
  return abi.filter((item) => item.type === 'error')
}

// Get errors from contract ABIs
const optimexLiquidatorErrors = filterErrors(OptimexLiquidator__factory.abi)
const paymentErrors = filterErrors(Payment__factory.abi)
const morphoLiquidationErrors = filterErrors(MorphoLiquidationGateway__factory.abi)

export const errorDecoder = (): ErrorDecoder => {
  return ErrorDecoder.create([optimexLiquidatorErrors, paymentErrors, morphoLiquidationErrors])
}

export default errorDecoder
