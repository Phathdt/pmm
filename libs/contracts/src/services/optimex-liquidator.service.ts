import { AbiCoder, ContractRunner, keccak256, Wallet } from 'ethers'

import { MultisigAuthStruct, OptimexLiquidator__factory, PaymentRequestStruct } from '../contracts'

/**
 * EIP-712 domain info returned from contract's eip712Domain() function
 */
export interface EIP712DomainInfo {
  name: string
  version: string
  chainId: bigint
  verifyingContract: string
}

/**
 * Parameters for building multisig auth
 */
export interface BuildMultisigAuthParams {
  provider: ContractRunner
  contractAddress: string
  executorAddress: string
  paymentRequest: PaymentRequestStruct
  approverSigners: Wallet[]
  deadlineSeconds: number
}

/**
 * Singleton service for OptimexLiquidator contract interactions
 */
class OptimexLiquidatorServiceImpl {
  private static instance: OptimexLiquidatorServiceImpl

  private constructor() {}

  static getInstance(): OptimexLiquidatorServiceImpl {
    if (!OptimexLiquidatorServiceImpl.instance) {
      OptimexLiquidatorServiceImpl.instance = new OptimexLiquidatorServiceImpl()
    }
    return OptimexLiquidatorServiceImpl.instance
  }

  /**
   * Get EIP-712 domain from OptimexLiquidator contract
   */
  async getEIP712Domain(provider: ContractRunner, contractAddress: string): Promise<EIP712DomainInfo> {
    const contract = OptimexLiquidator__factory.connect(contractAddress, provider)
    const domainResult = await contract.eip712Domain()

    return {
      name: domainResult.name,
      version: domainResult.version,
      chainId: domainResult.chainId,
      verifyingContract: domainResult.verifyingContract,
    }
  }

  /**
   * Build multisig auth with signatures for payment
   */
  async buildMultisigAuth(params: BuildMultisigAuthParams): Promise<MultisigAuthStruct> {
    const { provider, contractAddress, executorAddress, paymentRequest, approverSigners, deadlineSeconds } = params

    const threshold = approverSigners.length
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)

    // Get EIP-712 domain from contract
    const domainInfo = await this.getEIP712Domain(provider, contractAddress)

    // Compute context hash
    const contextHash = this.computeContextHash(executorAddress, deadline, threshold, paymentRequest)

    // Collect signatures from all approvers (sorted by address ascending)
    const signatures = await this.collectSignatures(approverSigners, domainInfo, contextHash)

    return { deadline, threshold, signatures }
  }

  /**
   * Compute context hash for payment approval
   */
  private computeContextHash(
    sender: string,
    deadline: bigint,
    threshold: number,
    paymentRequest: PaymentRequestStruct
  ): string {
    const abiCoder = AbiCoder.defaultAbiCoder()
    return keccak256(
      abiCoder.encode(
        ['address', 'uint64', 'uint16', 'tuple(address,uint256,bytes)'],
        [sender, deadline, threshold, [paymentRequest.token, paymentRequest.amount, paymentRequest.externalCall]]
      )
    )
  }

  /**
   * Collect signatures from approvers, sorted by address ascending
   */
  private async collectSignatures(
    approverSigners: Wallet[],
    domainInfo: EIP712DomainInfo,
    contextHash: string
  ): Promise<string[]> {
    // Sort wallets by address (ascending) - required by contract
    const sortedWallets = [...approverSigners].sort((a, b) => {
      const addrA = BigInt(a.address)
      const addrB = BigInt(b.address)
      return addrA < addrB ? -1 : addrA > addrB ? 1 : 0
    })

    const domain = {
      name: domainInfo.name,
      version: domainInfo.version,
      chainId: domainInfo.chainId,
      verifyingContract: domainInfo.verifyingContract,
    }
    const types = { ApprovePayment: [{ name: 'contextHash', type: 'bytes32' }] }
    const value = { contextHash }

    const signatures: string[] = []
    for (const wallet of sortedWallets) {
      const signature = await wallet.signTypedData(domain, types, value)
      signatures.push(signature)
    }

    return signatures
  }
}

/**
 * Singleton instance of OptimexLiquidatorService
 */
export const OptimexLiquidatorService = OptimexLiquidatorServiceImpl.getInstance()
