import * as anchor from '@coral-xyz/anchor'
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { AccountMeta, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'

import IDL from './idl.json'
import { BitfiSolSmartcontract } from './types/contract'

export async function payment({
  signer,
  tradeId,
  amount,
  protocolFee,
  deadline,
  toUserPubkey,
  connection,
  tokenAddr,
}: {
  signer: PublicKey
  tradeId: string
  amount: string
  protocolFee: string
  deadline: number
  toUserPubkey: PublicKey
  connection: Connection
  tokenAddr?: PublicKey
}) {
  const instructions: TransactionInstruction[] = []
  let accountInfo: any
  let paymentIns: TransactionInstruction

  const program = new anchor.Program<BitfiSolSmartcontract>(IDL as BitfiSolSmartcontract, {
    connection: connection as any,
  })

  if (tokenAddr) {
    //  generate Protocol ATA to receive the `protocolFee`
    const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('protocol')], program.programId)
    const protocolAta = getAssociatedTokenAddressSync(tokenAddr, protocolPda, true)
    accountInfo = await connection.getAccountInfo(protocolAta)
    if (!accountInfo)
      instructions.push(
        createAssociatedTokenAccountInstruction(
          signer,
          protocolAta,
          protocolPda, //  owner of the `protocolAta`
          tokenAddr
        )
      )

    //  generate Payer (PMM) ATA
    const payerAta = getAssociatedTokenAddressSync(tokenAddr, signer, false)

    //  generate User (Receiver) ATA
    const userAta = getAssociatedTokenAddressSync(tokenAddr, toUserPubkey, false)
    accountInfo = await connection.getAccountInfo(userAta)
    if (!accountInfo)
      instructions.push(
        createAssociatedTokenAccountInstruction(
          signer,
          userAta,
          toUserPubkey, //  owner of the `userAta`
          tokenAddr
        )
      )

    const metaAccounts: AccountMeta[] = [
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: tokenAddr, isSigner: false, isWritable: false },
      { pubkey: payerAta, isSigner: false, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      {
        pubkey: protocolAta,
        isSigner: false,
        isWritable: true,
      },
    ]

    paymentIns = await program.methods
      .payment({
        tradeId: bigintToBytes32(BigInt(tradeId)),
        token: tokenAddr,
        amount: new anchor.BN(amount),
        protocolFee: new anchor.BN(protocolFee),
        deadline: new anchor.BN(deadline),
      })
      .accounts({
        signer: signer,
        toUser: toUserPubkey,
      })
      .remainingAccounts(metaAccounts)
      .instruction()
  } else {
    paymentIns = await program.methods
      .payment({
        tradeId: bigintToBytes32(BigInt(tradeId)),
        token: null,
        amount: new anchor.BN(amount),
        protocolFee: new anchor.BN(protocolFee),
        deadline: new anchor.BN(deadline),
      })
      .accounts({
        signer: signer,
        toUser: toUserPubkey,
      })
      .instruction()
  }

  instructions.push(paymentIns)

  const tx = new Transaction().add(...instructions)
  tx.feePayer = signer
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  return tx
}

export function bigintToBytes32(value: bigint): number[] {
  // Convert to hex, pad to 64 chars (32 bytes) and remove 0x
  const hex = value.toString(16).padStart(64, '0')
  return Array.from(Buffer.from(hex, 'hex'))
}
