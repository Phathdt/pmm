export const managementErrorABI = [
  {
    inputs: [],
    name: 'NetworkNotFound',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
    ],
    name: 'OwnableInvalidOwner',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'OwnableUnauthorizedAccount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'RegisteredAlready',
    type: 'error',
  },
  {
    inputs: [],
    name: 'UnregisteredAlready',
    type: 'error',
  },
];

export const routerErrorABI = [
  {
    inputs: [],
    name: 'AddressZero',
    type: 'error',
  },
  {
    inputs: [],
    name: 'RouteNotFound',
    type: 'error',
  },
  {
    inputs: [],
    name: 'RouteNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'Unauthorized',
    type: 'error',
  },
];

export const inspectorErrorABI = [
  {
    inputs: [],
    name: 'AddressZero',
    type: 'error',
  },
  {
    inputs: [],
    name: 'Unauthorized',
    type: 'error',
  },
];

export const btcevmErrorABI = [
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
    name: 'InSuspension',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InsufficientQuoteAmount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidMPCSign',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPMMSelection',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPMMSign',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'expectedStage',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'currentStage',
        type: 'uint256',
      },
    ],
    name: 'InvalidProcedureState',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidRFQSign',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidTimeout',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidTradeId',
    type: 'error',
  },
  {
    inputs: [],
    name: 'MPCPubkeyNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'PMMAddrNotMatched',
    type: 'error',
  },
  {
    inputs: [],
    name: 'PMMNotRegistered',
    type: 'error',
  },
  {
    inputs: [],
    name: 'RouteNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'SignatureExpired',
    type: 'error',
  },
  {
    inputs: [],
    name: 'TokenNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'UTXOAddrNotMatched',
    type: 'error',
  },
  {
    inputs: [],
    name: 'Unauthorized',
    type: 'error',
  },
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
    name: 'InvalidShortString',
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
  {
    anonymous: false,
    inputs: [],
    name: 'EIP712DomainChanged',
    type: 'event',
  },
];

export const evmbtcErrorABI = [
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
    name: 'InSuspension',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InsufficientQuoteAmount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidMPCSign',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPMMSelection',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPMMSign',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidPresign',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'expectedStage',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'currentStage',
        type: 'uint256',
      },
    ],
    name: 'InvalidProcedureState',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidRFQSign',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidTimeout',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidTradeId',
    type: 'error',
  },
  {
    inputs: [],
    name: 'MPCPubkeyNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'PMMAddrNotMatched',
    type: 'error',
  },
  {
    inputs: [],
    name: 'PMMNotRegistered',
    type: 'error',
  },
  {
    inputs: [],
    name: 'RouteNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'SignatureExpired',
    type: 'error',
  },
  {
    inputs: [],
    name: 'TokenNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'Unauthorized',
    type: 'error',
  },
  {
    inputs: [],
    name: 'VaultAddrNotMatched',
    type: 'error',
  },
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
    name: 'InvalidShortString',
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
  {
    anonymous: false,
    inputs: [],
    name: 'EIP712DomainChanged',
    type: 'event',
  },
];
