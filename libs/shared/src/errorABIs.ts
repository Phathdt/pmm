export const paymentErrorABI = [
  {
    inputs: [],
    name: 'AddressZero',
    type: 'error',
  },
  {
    inputs: [],
    name: 'DeadlineExceeded',
    type: 'error',
  },
  {
    inputs: [],
    name: 'FailedCall',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'balance',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'needed',
        type: 'uint256',
      },
    ],
    name: 'InsufficientBalance',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPaymentAmount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NativeCoinNotMatched',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ReentrancyGuardReentrantCall',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'SafeERC20FailedOperation',
    type: 'error',
  },
  {
    inputs: [],
    name: 'Unauthorized',
    type: 'error',
  },
]

export const liquidationErrorABI = [
  {
    inputs: [],
    name: 'ECDSAInvalidSignature',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'length',
        type: 'uint256',
      },
    ],
    name: 'ECDSAInvalidSignatureLength',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 's',
        type: 'bytes32',
      },
    ],
    name: 'ECDSAInvalidSignatureS',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidMorpho',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidShortString',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'validator',
        type: 'address',
      },
    ],
    name: 'NotAuthorizedValidator',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NotEnoughPaymentAmount',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: 'str',
        type: 'string',
      },
    ],
    name: 'StringTooLong',
    type: 'error',
  },
]
