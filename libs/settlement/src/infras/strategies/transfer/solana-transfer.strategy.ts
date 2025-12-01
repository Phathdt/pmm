import { BN } from '@coral-xyz/anchor'
import { Inject, Injectable } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { EnhancedLogger } from '@optimex-pmm/custom-logger'
import { INotificationService, NOTIFICATION_SERVICE } from '@optimex-pmm/notification'
import { routerService } from '@optimex-xyz/market-maker-sdk'
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { AccountMeta, Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'

import bs58 from 'bs58'

import { optimexSolProgram } from '../../../artifacts'
import { ITransferStrategy, TransferParams, TransferResult } from '../../../domain'
import {
  bigintToBytes32,
  createAssociatedTokenAccountInstructionIfNeeded,
  getPaymentReceiptPda,
  getProtocolPda,
  getWhitelistPda,
  sendTransactionWithRetry,
  WSOL_MINT,
} from '../../../utils'

@Injectable()
export class SolanaTransferStrategy implements ITransferStrategy {
  private pmmKeypair: Keypair
  private connection: Connection

  private readonly logger: EnhancedLogger

  constructor(
    readonly configService: CustomConfigService,
    @Inject(NOTIFICATION_SERVICE) private readonly notificationService: INotificationService,
    logger: EnhancedLogger
  ) {
    this.logger = logger.with({ context: SolanaTransferStrategy.name })
    this.connection = new Connection(configService.rpc.solanaUrl, 'confirmed')

    const privateKeyString = configService.pmm.solana.privateKey
    const privateKeyBytes = bs58.decode(privateKeyString)
    this.pmmKeypair = Keypair.fromSecretKey(privateKeyBytes)
  }

  private async checkBalance(token: PublicKey | null, amount: bigint): Promise<boolean> {
    try {
      let balance: bigint
      if (token === null) {
        // Check SOL balance
        balance = BigInt(await this.connection.getBalance(this.pmmKeypair.publicKey))
        this.logger.log({
          message: 'Checking SOL balance',
          walletAddress: this.pmmKeypair.publicKey.toBase58(),
          tokenType: 'native',
          operation: 'solana_check_balance',
          timestamp: new Date().toISOString(),
        })
      } else {
        // Check SPL token balance
        const ata = await getAssociatedTokenAddress(token, this.pmmKeypair.publicKey, true)
        const tokenBalance = await this.connection.getTokenAccountBalance(ata)
        balance = BigInt(tokenBalance.value.amount)
        this.logger.log({
          message: 'Checking SPL token balance',
          tokenAddress: token.toBase58(),
          associatedTokenAccount: ata.toBase58(),
          decimals: tokenBalance.value.decimals,
          tokenType: 'spl',
          operation: 'solana_check_balance',
          timestamp: new Date().toISOString(),
        })
      }

      if (balance < amount) {
        const message = `⚠️ Insufficient Balance Alert\n\nToken: ${token ? token.toBase58() : 'SOL'}\nRequired: ${amount.toString()}\nAvailable: ${balance.toString()}\nAddress: ${this.pmmKeypair.publicKey.toBase58()}`
        await this.notificationService.sendTelegramMessage(message)
        return false
      }
      return true
    } catch (error: unknown) {
      this.logger.error({
        message: 'Error checking balance',
        error: error instanceof Error ? error.message : String(error),
        tokenAddress: token ? token.toBase58() : 'SOL',
        operation: 'solana_check_balance',
        timestamp: new Date().toISOString(),
      })
      return false
    }
  }

  async transfer(params: TransferParams): Promise<TransferResult> {
    const { toAddress, amount, tradeId, token } = params
    const deadline = Math.floor(Date.now() / 1000) + 3600
    this.logger.log({
      message: 'Starting Solana transfer',
      tradeId,
      toAddress,
      amount: amount.toString(),
      tokenAddress: token.tokenAddress,
      networkName: token.networkName,
      operation: 'solana_transfer',
      status: 'starting',
      timestamp: new Date().toISOString(),
    })
    this.logger.log({
      message: 'PMM keypair configured',
      tradeId,
      pmmPublicKey: this.pmmKeypair.publicKey.toBase58(),
      operation: 'solana_transfer_setup',
      timestamp: new Date().toISOString(),
    })
    const fromUser = new PublicKey(this.pmmKeypair.publicKey)
    const toUser = new PublicKey(toAddress)
    const toToken = token.tokenAddress === 'native' ? null : new PublicKey(token.tokenAddress)
    this.logger.log({
      message: 'Sender wallet configured',
      senderAddress: fromUser.toBase58(),
      operation: 'solana_transfer_setup',
      timestamp: new Date().toISOString(),
    })
    this.logger.log({
      message: 'Transfer addresses configured',
      tradeId,
      toTokenAddress: toToken?.toBase58() || 'native',
      fromUserAddress: fromUser.toBase58(),
      toUserAddress: toUser.toBase58(),
      operation: 'solana_transfer_setup',
      timestamp: new Date().toISOString(),
    })

    // Check balance before proceeding
    const hasSufficientBalance = await this.checkBalance(toToken, amount)
    if (!hasSufficientBalance) {
      throw new Error('Insufficient balance for transfer')
    }

    const feeDetails = await routerService.getFeeDetails(tradeId)
    this.logger.log({
      message: 'Optimex program configured',
      tradeId,
      programId: optimexSolProgram.programId.toBase58(),
      operation: 'solana_transfer_setup',
      timestamp: new Date().toISOString(),
    })
    const protocolPda = getProtocolPda()
    this.logger.log({
      message: 'Protocol PDA configured',
      tradeId,
      protocolPda: protocolPda.toBase58(),
      operation: 'solana_transfer_setup',
      timestamp: new Date().toISOString(),
    })

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

    this.logger.log({
      message: 'Payment accounts prepared',
      tradeId,
      whitelistToken: whitelistToken.toBase58(),
      paymentReceiptPda: paymentReceiptPda.toBase58(),
      protocolPda: protocolPda.toBase58(),
      toTokenAddress: toToken?.toBase58() || 'native',
      operation: 'solana_transfer_payment',
      timestamp: new Date().toISOString(),
    })
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

    this.logger.log({
      message: 'Payment transaction prepared',
      tradeId,
      fromUserAddress: fromUser.toBase58(),
      toUserAddress: toUser.toBase58(),
      toTokenAddress: toToken?.toBase58() || 'native',
      amount: amount.toString(),
      feeAmount: feeDetails.totalAmount.toString(),
      operation: 'solana_transfer_payment',
      timestamp: new Date().toISOString(),
    })

    const transaction = new Transaction().add(...createDestinationAtaIns, paymentIns)
    try {
      const txHash = await sendTransactionWithRetry(this.connection, transaction, [this.pmmKeypair])
      this.logger.log({
        message: 'Solana payment completed successfully',
        tradeId,
        transactionSignature: txHash,
        operation: 'solana_transfer',
        status: 'success',
        timestamp: new Date().toISOString(),
      })

      return { hash: txHash }
    } catch (error: unknown) {
      this.logger.error({
        message: 'Solana payment failed',
        tradeId,
        error: error instanceof Error ? error.message : String(error),
        operation: 'solana_transfer',
        status: 'failed',
        timestamp: new Date().toISOString(),
      })
      throw error
    }
  }
}
