import { BN } from '@coral-xyz/anchor'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { routerService } from '@optimex-xyz/market-maker-sdk'
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { AccountMeta, Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'

import bs58 from 'bs58'

import { optimexSolProgram } from '../../artifacts'
import { ITransferStrategy, TransferParams } from '../../interfaces'
import {
  bigintToBytes32,
  createAssociatedTokenAccountInstructionIfNeeded,
  getPaymentReceiptPda,
  getProtocolPda,
  getWhitelistPda,
  WSOL_MINT,
} from '../../utils'

@Injectable()
export class SolanaTransferStrategy implements ITransferStrategy {
  private pmmKeypair: Keypair
  private connection: Connection

  private readonly logger = new Logger(SolanaTransferStrategy.name)

  constructor(configService: ConfigService) {
    const endpoint = configService.getOrThrow('SOLANA_RPC_URL')
    this.connection = new Connection(endpoint, 'confirmed')

    const privateKeyString = configService.getOrThrow('PMM_SOLANA_PRIVATE_KEY')
    const privateKeyBytes = bs58.decode(privateKeyString)
    this.pmmKeypair = Keypair.fromSecretKey(privateKeyBytes)
  }

  async transfer(params: TransferParams): Promise<string> {
    const { toAddress, amount, tradeId, token } = params
    const deadline = Math.floor(Date.now() / 1000) + 3600
    const fromUser = new PublicKey(this.pmmKeypair.publicKey)
    const toUser = new PublicKey(toAddress)
    const toToken = token.tokenAddress === 'native' ? null : new PublicKey(token.tokenAddress)

    const feeDetails = await routerService.getFeeDetails(tradeId)
    const protocolPda = getProtocolPda()

    const remainingAccounts: AccountMeta[] = []
    let whitelistToken: PublicKey
    if (toToken) {
      whitelistToken = getWhitelistPda(toToken)
      const fromUserAta = await getAssociatedTokenAddress(toToken, fromUser, true)
      const toUserAta = await getAssociatedTokenAddress(toToken, toUser, true)
      const protocolAta = await getAssociatedTokenAddress(toToken, protocolPda, true)
      remainingAccounts.push(
        {
          pubkey: TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: toToken,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: fromUserAta,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: toUserAta,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: protocolAta,
          isSigner: false,
          isWritable: true,
        }
      )
    } else {
      whitelistToken = getWhitelistPda(WSOL_MINT)
    }

    const paymentReceiptPda = getPaymentReceiptPda({
      tradeId,
      fromUser,
      toUser,
      amount,
      protocolFee: feeDetails.totalAmount,
      token: toToken,
    })

    this.logger.log(`Payment SOL tradeId ${tradeId}`, { whitelistToken, paymentReceiptPda, protocolPda, toToken })
    const paymentIns = await optimexSolProgram.methods
      .payment({
        tradeId: bigintToBytes32(BigInt(tradeId)),
        token: toToken,
        amount: new BN(amount.toString()),
        totalFee: new BN(feeDetails.totalAmount.toString()),
        deadline: new BN(deadline),
      })
      .accounts({
        signer: fromUser,
        toUser: toUser,
        whitelistToken,
        paymentReceipt: paymentReceiptPda,
      })
      .remainingAccounts(remainingAccounts)
      .instruction()

    const createDestinationAtaIns = await createAssociatedTokenAccountInstructionIfNeeded(
      this.connection,
      fromUser,
      toToken,
      toUser
    )

    this.logger.log(`Payment prepare ${tradeId}`, {
      fromUser,
      toUser,
      toToken,
      amount,
      feeAmount: feeDetails.totalAmount,
    })

    const transaction = new Transaction().add(...createDestinationAtaIns, paymentIns)
    try {
      const txHash = await sendAndConfirmTransaction(this.connection, transaction, [this.pmmKeypair], {
        commitment: 'confirmed',
      })
      this.logger.log('Payment successful! ', tradeId)
      this.logger.log('Transaction signature:', txHash)

      return txHash
    } catch (error) {
      this.logger.error('Payment failed', tradeId)
      this.logger.error(error)
      throw error
    }
  }
}
