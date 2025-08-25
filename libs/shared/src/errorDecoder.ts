import { ErrorDecoder } from 'ethers-decode-error'

import { liquidationErrorABI, paymentErrorABI } from './errorABIs'

export const errorDecoder = (): ErrorDecoder => {
  return ErrorDecoder.create([paymentErrorABI, liquidationErrorABI])
}

export default errorDecoder
