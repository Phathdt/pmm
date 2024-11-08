import { ErrorDecoder } from 'ethers-decode-error';

import {
  btcevmErrorABI,
  evmbtcErrorABI,
  inspectorErrorABI,
  managementErrorABI,
  routerErrorABI,
} from './errorABIs';

export const errorDecoder = (contract: string): ErrorDecoder => {
  let abi: any;
  if (contract === 'BITFI_MANAGEMENT') abi = managementErrorABI;
  else if (contract === 'ROUTER') abi = routerErrorABI;
  else if (contract === 'INSPECTOR') abi = inspectorErrorABI;
  else if (contract === 'BTCEVM') abi = btcevmErrorABI;
  else if (contract === 'EVMBTC') abi = evmbtcErrorABI;
  else throw new Error('Invalid Contract! Contract not supported');

  return ErrorDecoder.create([abi]);
};

export default errorDecoder;
