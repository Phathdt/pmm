import bs58 from 'bs58'

import { routerService } from '@bitfixyz/market-maker-sdk'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'

import { ITransferStrategy, TransferParams } from '../../interfaces'
import { payment } from './utils/payment'

@Injectable()
export class SolanaTransferStrategy implements ITransferStrategy {
  private signer: PublicKey
  private connection: Connection
  private keypair: Keypair
  private routerService = routerService

  private readonly logger = new Logger(SolanaTransferStrategy.name)

  constructor(configService: ConfigService) {
    const endpoint = configService.getOrThrow('SOLANA_RPC_URL')
    this.connection = new Connection(endpoint, 'confirmed')

    const privateKeyString = configService.getOrThrow('PMM_SOLANA_PRIVATE_KEY')
    const privateKeyBytes = bs58.decode(privateKeyString)
    this.signer = Keypair.fromSecretKey(privateKeyBytes).publicKey

    this.keypair = Keypair.fromSecretKey(privateKeyBytes)
  }

  async transfer(params: TransferParams): Promise<string> {
    const { toAddress, amount, tradeId } = params
    const deadline = Math.floor(Date.now() / 1000) + 3600
    const toUserPubkey = new PublicKey(toAddress)

    const protocolFee = await this.routerService.getProtocolFee(tradeId)

    const transaction = await payment({
      signer: this.signer,
      tradeId: tradeId,
      amount: amount.toString(),
      protocolFee: protocolFee.amount.toString(),
      deadline,
      toUserPubkey,
      connection: this.connection,
    })

    transaction.sign(this.keypair)

    const signature = await this.connection.sendRawTransaction(transaction.serialize())

    const latestBlockhash = await this.connection.getLatestBlockhash()
    const confirmation = await this.connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    })

    this.logger.log('Payment successful!')
    this.logger.log('Transaction signature:', signature)
    this.logger.log('Confirmation:', confirmation)

    return signature
  }
}
