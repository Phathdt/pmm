/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bitfi_sol_smartcontract.json`.
 */
export type BitfiSolSmartcontract = {
  address: 'GweDPiGrzuJCxgxS81bAzdU81gTMP2tUwfrR5bWGi8qN'
  metadata: {
    name: 'bitfiSolSmartcontract'
    version: '0.1.0'
    spec: '0.1.0'
    description: 'Created with Anchor'
  }
  instructions: [
    {
      name: 'claim'
      docs: [
        '@notice Claim the deposited amount after the timeout\n        @dev\n        - Requirements:\n            - Caller must be authorized:\n                - Caller can be anyone\n            - Available to call when `timestamp > timeout`\n        - Params:\n            - claim_args           Arguments required for the claim'
      ]
      discriminator: [62, 198, 214, 193, 213, 159, 108, 210]
      accounts: [
        {
          name: 'signer'
          writable: true
          signer: true
        },
        {
          name: 'userAccount'
          writable: true
        },
        {
          name: 'userTradeDetail'
          writable: true
        },
        {
          name: 'userProtocolFee'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [117, 115, 101, 114, 95, 112, 114, 111, 116, 111, 99, 111, 108, 95, 102, 101, 101]
              },
              {
                kind: 'account'
                path: 'userTradeDetail'
              }
            ]
          }
        },
        {
          name: 'vault'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [118, 97, 117, 108, 116]
              }
            ]
          }
        },
        {
          name: 'refundAccount'
          writable: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'claimArgs'
          type: {
            defined: {
              name: 'claimArgs'
            }
          }
        }
      ]
    },
    {
      name: 'deposit'
      docs: [
        '@notice Handles the deposit of either tokens or SOL into the vault\n        @dev\n        - Requirements:\n            - Available to call when `timestamp <= timeout`\n        - Params:\n            - deposit_args         Arguments required for the deposit'
      ]
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182]
      accounts: [
        {
          name: 'signer'
          writable: true
          signer: true
        },
        {
          name: 'userTradeDetail'
          writable: true
        },
        {
          name: 'userProtocolFee'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [117, 115, 101, 114, 95, 112, 114, 111, 116, 111, 99, 111, 108, 95, 102, 101, 101]
              },
              {
                kind: 'account'
                path: 'userTradeDetail'
              }
            ]
          }
        },
        {
          name: 'vault'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [118, 97, 117, 108, 116]
              }
            ]
          }
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'depositArgs'
          type: {
            defined: {
              name: 'depositArgs'
            }
          }
        }
      ]
    },
    {
      name: 'init'
      docs: [
        '@notice Initializes the vault and protocol accounts\n        @dev\n        - Requirements:\n            - Caller must be authorized\n        - Params:\n            - init_args            Arguments required for initialization (currently empty)'
      ]
      discriminator: [220, 59, 207, 236, 108, 250, 47, 100]
      accounts: [
        {
          name: 'signer'
          writable: true
          signer: true
        },
        {
          name: 'vault'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [118, 97, 117, 108, 116]
              }
            ]
          }
        },
        {
          name: 'protocol'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 114, 111, 116, 111, 99, 111, 108]
              }
            ]
          }
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'program'
          address: 'GweDPiGrzuJCxgxS81bAzdU81gTMP2tUwfrR5bWGi8qN'
        },
        {
          name: 'programData'
        }
      ]
      args: [
        {
          name: 'initArgs'
          type: {
            defined: {
              name: 'initArgs'
            }
          }
        }
      ]
    },
    {
      name: 'payment'
      docs: [
        '@notice Handles the payment process\n        @dev\n        - Requirements:\n            - Caller must be authorized\n        - Params:\n            - deposit_args         Arguments required for the payment'
      ]
      discriminator: [156, 226, 80, 91, 104, 252, 49, 142]
      accounts: [
        {
          name: 'signer'
          docs: ['The signer account, which must be mutable.']
          writable: true
          signer: true
        },
        {
          name: 'toUser'
          docs: ['The account to which the payment will be sent.']
          writable: true
        },
        {
          name: 'protocol'
          docs: ['The protocol account to which the protocol fee will be sent.']
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 114, 111, 116, 111, 99, 111, 108]
              }
            ]
          }
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'paymentArgs'
          type: {
            defined: {
              name: 'paymentArgs'
            }
          }
        }
      ]
    },
    {
      name: 'setProtocolFee'
      docs: [
        '@notice Sets the protocol fee for a trade\n        @dev\n        - Requirements:\n            - Signature that signed by MPC\n        - Params:\n            - set_protocol_fee_args Arguments required for setting the protocol fee'
      ]
      discriminator: [173, 239, 83, 242, 136, 43, 144, 217]
      accounts: [
        {
          name: 'signer'
          docs: ['The signer account, which must be mutable and authorized']
          writable: true
          signer: true
        },
        {
          name: 'userTradeDetail'
          docs: ['The user trade detail account']
        },
        {
          name: 'userProtocolFee'
          docs: ['The user protocol fee account']
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [117, 115, 101, 114, 95, 112, 114, 111, 116, 111, 99, 111, 108, 95, 102, 101, 101]
              },
              {
                kind: 'account'
                path: 'userTradeDetail'
              }
            ]
          }
        }
      ]
      args: [
        {
          name: 'setProtocolFeeArgs'
          type: {
            defined: {
              name: 'setProtocolFeeArgs'
            }
          }
        }
      ]
    },
    {
      name: 'settlement'
      docs: [
        '@notice Transfer `amount` to `toAddress` to finalize the `tradeId`\n        @dev\n        - Requirements:\n            - Caller must be authorized:\n                - Signature that signed by MPC\n                - Signature that signed by the user\n            - Available to call when `timestamp <= timeout`\n        - Params:\n            - payment_args         Arguments required for the settlement'
      ]
      discriminator: [128, 21, 174, 60, 47, 86, 130, 108]
      accounts: [
        {
          name: 'signer'
          writable: true
          signer: true
        },
        {
          name: 'userAccount'
          writable: true
        },
        {
          name: 'userEphemeralAccount'
          signer: true
        },
        {
          name: 'userTradeDetail'
          writable: true
        },
        {
          name: 'userProtocolFee'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [117, 115, 101, 114, 95, 112, 114, 111, 116, 111, 99, 111, 108, 95, 102, 101, 101]
              },
              {
                kind: 'account'
                path: 'userTradeDetail'
              }
            ]
          }
        },
        {
          name: 'vault'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [118, 97, 117, 108, 116]
              }
            ]
          }
        },
        {
          name: 'refundAccount'
          writable: true
        },
        {
          name: 'protocol'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 114, 111, 116, 111, 99, 111, 108]
              }
            ]
          }
        },
        {
          name: 'pmm'
          writable: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'paymentArgs'
          type: {
            defined: {
              name: 'settlementArgs'
            }
          }
        }
      ]
    }
  ]
  accounts: [
    {
      name: 'tradeDetail'
      discriminator: [241, 58, 83, 75, 150, 155, 85, 205]
    },
    {
      name: 'userProtocolFee'
      discriminator: [163, 86, 182, 157, 16, 177, 224, 222]
    }
  ]
  events: [
    {
      name: 'claimed'
      discriminator: [217, 192, 123, 72, 108, 150, 248, 33]
    },
    {
      name: 'deposited'
      discriminator: [111, 141, 26, 45, 161, 35, 100, 57]
    },
    {
      name: 'paymentTransferred'
      discriminator: [206, 116, 224, 136, 100, 105, 246, 173]
    },
    {
      name: 'settled'
      discriminator: [232, 210, 40, 17, 142, 124, 145, 238]
    }
  ]
  errors: [
    {
      code: 6000
      name: 'invalidTradeId'
    },
    {
      code: 6001
      name: 'invalidTimeout'
    },
    {
      code: 6002
      name: 'unauthorized'
    },
    {
      code: 6003
      name: 'invalidPublicKey'
    },
    {
      code: 6004
      name: 'depositZeroAmount'
    },
    {
      code: 6005
      name: 'invalidAmount'
    },
    {
      code: 6006
      name: 'invalidMintKey'
    },
    {
      code: 6007
      name: 'invalidSourceAta'
    },
    {
      code: 6008
      name: 'invalidDestinationAta'
    },
    {
      code: 6009
      name: 'timeOut'
    },
    {
      code: 6010
      name: 'invalidRefundPubkey'
    },
    {
      code: 6011
      name: 'cLaimNotAvailable'
    },
    {
      code: 6012
      name: 'deadlineExceeded'
    },
    {
      code: 6013
      name: 'invalidUserAccount'
    },
    {
      code: 6014
      name: 'invalidUserEphemeralPubkey'
    }
  ]
  types: [
    {
      name: 'claimArgs'
      docs: ['Arguments required for the claim function']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tradeId'
            docs: ['Unique identifier for the trade']
            type: {
              array: ['u8', 32]
            }
          }
        ]
      }
    },
    {
      name: 'claimed'
      docs: [
        '- @dev Event emitted when a user successfully claims the deposit after timeout\n    - Related function: claim()'
      ]
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tradeId'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'token'
            type: {
              option: 'pubkey'
            }
          },
          {
            name: 'toPubkey'
            type: 'pubkey'
          },
          {
            name: 'operator'
            type: 'pubkey'
          },
          {
            name: 'amount'
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'depositArgs'
      docs: ['Arguments required for the deposit function']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'input'
            docs: ['Input trade information']
            type: {
              defined: {
                name: 'tradeInput'
              }
            }
          },
          {
            name: 'data'
            docs: ['Detailed trade data']
            type: {
              defined: {
                name: 'tradeDetail'
              }
            }
          },
          {
            name: 'tradeId'
            docs: ['Unique identifier for the trade']
            type: {
              array: ['u8', 32]
            }
          }
        ]
      }
    },
    {
      name: 'deposited'
      docs: ['- @dev Event emitted when a user successfully deposits tokens or SOL\n    - Related function: deposit()']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tradeId'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'depositor'
            type: 'pubkey'
          },
          {
            name: 'token'
            type: {
              option: 'pubkey'
            }
          },
          {
            name: 'amount'
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'initArgs'
      docs: ['Arguments required for the init function']
      type: {
        kind: 'struct'
        fields: []
      }
    },
    {
      name: 'paymentArgs'
      docs: ['Arguments for the payment instruction.']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tradeId'
            docs: ['Unique identifier for the trade.']
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'token'
            docs: ['Optional token public key for SPL token payments.']
            type: {
              option: 'pubkey'
            }
          },
          {
            name: 'amount'
            docs: ['Amount to be transferred.']
            type: 'u64'
          },
          {
            name: 'protocolFee'
            docs: ['Protocol fee to be deducted from the amount.']
            type: 'u64'
          },
          {
            name: 'deadline'
            docs: ['Deadline for the payment transaction.']
            type: 'i64'
          }
        ]
      }
    },
    {
      name: 'paymentTransferred'
      docs: ['- @dev Event emitted when PMM successfully settle the payment\n    - Related function: payment();']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tradeId'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'fromPubkey'
            type: 'pubkey'
          },
          {
            name: 'toPubkey'
            type: 'pubkey'
          },
          {
            name: 'token'
            type: {
              option: 'pubkey'
            }
          },
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'protocolFee'
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'setProtocolFeeArgs'
      docs: ['Arguments required for setting the protocol fee']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tradeId'
            docs: ['Unique identifier for the trade']
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'amount'
            docs: ['Amount of the protocol fee']
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'settled'
      docs: ['- @dev Event emitted when MPC successfully settles the trade\n    - Related function: settlement()']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tradeId'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'token'
            type: {
              option: 'pubkey'
            }
          },
          {
            name: 'toPubkey'
            type: 'pubkey'
          },
          {
            name: 'operator'
            type: 'pubkey'
          },
          {
            name: 'settlementAmount'
            type: 'u64'
          },
          {
            name: 'feeAmount'
            type: 'u64'
          }
        ]
      }
    },
    {
      name: 'settlementArgs'
      docs: ['Arguments required for the settlement function']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tradeId'
            docs: ['Unique identifier for the trade']
            type: {
              array: ['u8', 32]
            }
          }
        ]
      }
    },
    {
      name: 'tradeDetail'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'token'
            type: {
              option: 'pubkey'
            }
          },
          {
            name: 'timeout'
            type: 'i64'
          },
          {
            name: 'mpcPubkey'
            type: 'pubkey'
          },
          {
            name: 'userEphemeralPubkey'
            type: 'pubkey'
          },
          {
            name: 'refundPubkey'
            type: 'pubkey'
          },
          {
            name: 'userPubkey'
            type: 'pubkey'
          }
        ]
      }
    },
    {
      name: 'tradeInfo'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amountIn'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'fromChain'
            type: {
              array: ['bytes', 3]
            }
          },
          {
            name: 'toChain'
            type: {
              array: ['bytes', 3]
            }
          }
        ]
      }
    },
    {
      name: 'tradeInput'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'sessionId'
            type: {
              array: ['u8', 32]
            }
          },
          {
            name: 'solver'
            type: {
              array: ['u8', 20]
            }
          },
          {
            name: 'tradeInfo'
            type: {
              defined: {
                name: 'tradeInfo'
              }
            }
          }
        ]
      }
    },
    {
      name: 'userProtocolFee'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u64'
          }
        ]
      }
    }
  ]
}
