import { Injectable, Logger } from '@nestjs/common'
import { ERC20__factory } from '@optimex-xyz/market-maker-sdk'

import {
  BaseContract,
  ethers,
  TransactionRequest as EthersTransactionRequest,
  MaxUint256,
  TransactionResponse,
} from 'ethers'

import { NonceManagerService } from './nonce-manager.service'

export interface TransactionData {
  to?: string
  data?: string
  value?: bigint
  gasLimit?: bigint
  gasPrice?: bigint
  from?: string
}

export interface TransactionOptions {
  // Gas limit options
  gasBufferPercentage?: number
  minGasBuffer?: number
  maxGasLimit?: bigint
  fallbackGasLimit?: bigint
  description?: string
  gasLimit?: bigint
  value?: bigint

  // Enhanced gas price options
  gasPrice?: bigint // Legacy gas price
  maxFeePerGas?: bigint // EIP-1559 max fee per gas
  maxPriorityFeePerGas?: bigint // EIP-1559 priority fee
  gasPriceBufferPercentage?: number // Buffer for gas price volatility (default: 10%)
  maxGasPrice?: bigint // Maximum gas price limit
  fallbackGasPrice?: bigint // Fallback when estimation fails
}

export interface TransactionResult {
  hash: string
  gasUsed?: bigint
  effectiveGasPrice?: bigint
  blockNumber?: number
}

// Extract parameter types from a contract method's populateTransaction function
type ExtractPopulateTransactionParams<T> = T extends {
  populateTransaction: (...args: infer P) => Promise<EthersTransactionRequest>
}
  ? P
  : never

// Type to extract contract from TypeChain factory
type ExtractContract<T> = T extends { connect: (address: string, runner: ethers.ContractRunner) => infer C }
  ? C extends BaseContract
    ? C
    : never
  : never

/**
 * Service for executing transactions with TypeChain integration
 * Works with populateTransaction for type safety and automatic gas management
 */
@Injectable()
export class TransactionService {
  private readonly DEFAULT_GAS_BUFFER_PERCENTAGE = 50 // 50% buffer for gas limit
  private readonly DEFAULT_MIN_GAS_BUFFER = 50000
  private readonly DEFAULT_GAS_PRICE_BUFFER_PERCENTAGE = 30 // 30% buffer for gas price
  private readonly DEFAULT_MAX_GAS_PRICE_MULTIPLIER = 3 // Max 3x base fee
  private readonly logger = new Logger(TransactionService.name)

  constructor(private nonceManagerService: NonceManagerService) {}

  /**
   * Execute transaction with automatic gas handling
   * Works with TypeChain populated transactions for type safety
   * @param networkId Network to execute on
   * @param txData Transaction data (from populateTransaction)
   * @param options Gas and execution options
   * @returns Transaction result
   */
  async executeTransaction(
    networkId: string,
    txData: TransactionData,
    options: TransactionOptions = {}
  ): Promise<TransactionResult> {
    const wallet = this.nonceManagerService.getNonceManager(networkId)

    this.logger.log(`Executing transaction on network ${networkId}: ${options.description || 'Unknown'}`)

    try {
      // Gas limit handling (existing logic)
      let gasLimit = options.gasLimit || txData.gasLimit

      if (!gasLimit) {
        gasLimit = await this.estimateGasWithBuffer(txData, wallet, options)
      }

      // Enhanced gas price handling (NEW)
      const gasConfig = await this.getOptimalGasPrice(wallet, options)

      // Prepare final transaction with enhanced gas handling
      const finalTxData: EthersTransactionRequest = {
        ...txData,
        gasLimit,
        value: options.value || txData.value,
        ...gasConfig, // Spread gas price configuration (gasPrice OR maxFeePerGas + maxPriorityFeePerGas)
      }

      // Execute transaction
      const tx: TransactionResponse = await wallet.sendTransaction(finalTxData)

      // Enhanced logging with gas price information
      const gasType = gasConfig.maxFeePerGas ? 'EIP-1559' : 'Legacy'
      const gasValue = gasConfig.maxFeePerGas || gasConfig.gasPrice
      this.logger.log(`Transaction executed: ${tx.hash} (Gas Limit: ${gasLimit}, ${gasType} Price: ${gasValue})`)

      return { hash: tx.hash }
    } catch (error) {
      this.logger.error(`Transaction execution failed: ${error}`)

      // Enhanced error handling for gas-related issues
      if (this.isGasRelatedError(error)) {
        this.logger.error('Gas limit related error detected')
      }

      if (this.isGasPriceRelatedError(error)) {
        this.logger.error('Gas price related error detected - consider increasing gas price or buffer')
      }

      throw error
    }
  }

  /**
   * Execute contract method with automatic gas handling and full type safety
   * Combines populateTransaction and executeTransaction into one call
   * @param contractFactory TypeChain contract factory class
   * @param contractAddress Contract address to connect to
   * @param methodName Method name to call
   * @param args Method arguments (type-checked by TypeChain)
   * @param networkId Network to execute on
   * @param options Gas and execution options
   * @returns Transaction result
   */
  async executeContractMethod<
    TFactory extends { connect: (address: string, runner: ethers.ContractRunner) => BaseContract },
    TContract extends ExtractContract<TFactory>,
    TMethodName extends keyof TContract,
  >(
    contractFactory: TFactory,
    contractAddress: string,
    methodName: TMethodName,
    args: ExtractPopulateTransactionParams<TContract[TMethodName]>,
    networkId: string,
    options?: TransactionOptions
  ): Promise<TransactionResult> {
    const contract = contractFactory.connect(
      contractAddress,
      this.nonceManagerService.getNonceManager(networkId)
    ) as TContract
    // Step 1: Validate method exists
    const method = contract[methodName] as any
    if (!method || typeof method.populateTransaction !== 'function') {
      throw new Error(`Method ${String(methodName)} not found on contract or not callable`)
    }

    this.logger.log(`Executing contract method: ${String(methodName)} on network ${networkId}`)

    // Step 2: Try contract-specific gas estimation if not provided
    let gasLimit = options?.gasLimit
    if (!gasLimit) {
      gasLimit = await this.estimateContractGas(contract, methodName as any, args as any, options || {})
    }

    // Step 3: Use TypeChain to validate and populate transaction
    const txData = await method.populateTransaction(...(args as any[]))

    // Step 4: Pass validated transaction with gas limit to executeTransaction
    return await this.executeTransaction(networkId, txData, { ...options, gasLimit })
  }

  /**
   * Handle ERC20 token approval with allowance checking
   * @param networkId Network to execute on
   * @param tokenAddress ERC20 token contract address
   * @param spenderAddress Address to approve (usually contract address)
   * @param requiredAmount Amount that needs to be approved
   * @param options Transaction options
   */
  async handleTokenApproval(
    networkId: string,
    tokenAddress: string,
    spenderAddress: string,
    requiredAmount: bigint,
    options: TransactionOptions = {}
  ): Promise<void> {
    const wallet = this.nonceManagerService.getNonceManager(networkId)

    this.logger.log(`Checking token approval for ${tokenAddress} on network ${networkId}`)

    try {
      // Create ERC20 contract interface
      const erc20Contract = ERC20__factory.connect(tokenAddress, wallet.provider)
      const walletAddress = await wallet.getAddress()

      // Check current allowance
      const currentAllowance = await erc20Contract.allowance(walletAddress, spenderAddress)

      this.logger.log(`Current allowance: ${currentAllowance}, Required: ${requiredAmount}`)

      // If current allowance is sufficient, no action needed
      if (currentAllowance >= requiredAmount) {
        this.logger.log('Current allowance is sufficient, skipping approval')
        return
      }

      // If current allowance exists and is less than required, reset to 0 first
      // (Some tokens like USDT require this)
      if (currentAllowance > BigInt(0)) {
        this.logger.log('Resetting existing allowance to 0')
        await this.executeContractMethod(
          ERC20__factory,
          tokenAddress,
          'approve',
          [spenderAddress, BigInt(0)],
          networkId,
          {
            ...options,
            description: `Reset token approval to 0 for ${tokenAddress}`,
            fallbackGasLimit: options.fallbackGasLimit || BigInt(100000),
          }
        )
      }

      // Set new approval to maximum
      this.logger.log('Setting token approval to maximum')
      await this.executeContractMethod(
        ERC20__factory,
        tokenAddress,
        'approve',
        [spenderAddress, MaxUint256],
        networkId,
        {
          ...options,
          description: `Set token approval to max for ${tokenAddress}`,
          fallbackGasLimit: options.fallbackGasLimit || BigInt(100000),
        }
      )

      this.logger.log(`Token approval completed for ${tokenAddress}`)
    } catch (error) {
      this.logger.error(`Token approval failed for ${tokenAddress}:`, error)
      throw error
    }
  }

  // Private helper methods for gas limit (existing)
  private applyGasBuffer(estimatedGas: bigint, options: TransactionOptions): bigint {
    const bufferPercentage = options.gasBufferPercentage ?? this.DEFAULT_GAS_BUFFER_PERCENTAGE
    const minBuffer = BigInt(options.minGasBuffer ?? this.DEFAULT_MIN_GAS_BUFFER)

    const bufferAmount = (estimatedGas * BigInt(bufferPercentage)) / BigInt(100)
    const actualBuffer = bufferAmount > minBuffer ? bufferAmount : minBuffer
    const gasWithBuffer = estimatedGas + actualBuffer

    // Apply max gas limit if specified
    const maxGas = options.maxGasLimit
    const finalGas = maxGas && gasWithBuffer > maxGas ? maxGas : gasWithBuffer

    this.logger.log(`Gas calculation - Estimated: ${estimatedGas}, Buffer: ${actualBuffer}, Final: ${finalGas}`)

    return finalGas
  }

  /**
   * Estimate gas for contract method calls using contract-specific estimation
   * This method uses contract.estimateGas.methodName() for accurate gas estimation
   * that accounts for contract state changes, allowances, and complex logic
   * @param contract TypeChain contract instance
   * @param methodName Contract method name
   * @param args Method arguments
   * @param options Transaction options
   * @returns Estimated gas limit with buffer applied
   */
  private async estimateContractGas<T extends BaseContract, M extends keyof T>(
    contract: T,
    methodName: M,
    args: ExtractPopulateTransactionParams<T[M]>,
    options: TransactionOptions
  ): Promise<bigint> {
    this.logger.log(`Estimating gas for contract method: ${String(methodName)}`)

    try {
      // Step 1: Try contract-specific gas estimation
      const method = contract[methodName] as any
      if (method && typeof method.estimateGas === 'function') {
        this.logger.log('Using contract.estimateGas for accurate estimation')
        const estimatedGas = await method.estimateGas(...(args as any[]))
        const gasWithBuffer = this.applyGasBuffer(estimatedGas, options)
        this.logger.log(`Contract gas estimation successful: ${estimatedGas} -> ${gasWithBuffer} (with buffer)`)
        return gasWithBuffer
      }

      throw new Error('Contract method does not support gas estimation')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Contract gas estimation failed: ${errorMessage}`)

      // Step 2: Fallback to provider-based estimation with contract data
      return await this.fallbackContractGasEstimation(contract, methodName, args, options)
    }
  }

  /**
   * Fallback gas estimation using provider with properly encoded contract call data
   * This method is used when contract.estimateGas fails
   * @param contract TypeChain contract instance
   * @param methodName Contract method name
   * @param args Method arguments
   * @param options Transaction options
   * @returns Estimated gas limit with buffer applied
   */
  private async fallbackContractGasEstimation<T extends BaseContract, M extends keyof T>(
    contract: T,
    methodName: M,
    args: ExtractPopulateTransactionParams<T[M]>,
    options: TransactionOptions
  ): Promise<bigint> {
    try {
      this.logger.log('Using fallback provider estimation with contract data')
      const method = contract[methodName] as any
      const txData = await method.populateTransaction(...(args as any[]))

      // Get the signer address for proper estimation context
      const signer = contract.runner
      let from: string | undefined = undefined

      // Check if runner has getAddress method (like a Signer)
      if (signer && typeof (signer as any).getAddress === 'function') {
        try {
          from = await (signer as any).getAddress()
        } catch {
          this.logger.log('Could not get signer address for gas estimation')
        }
      }

      const estimationRequest: EthersTransactionRequest = {
        ...txData,
        from,
      }

      // Get provider from contract or runner
      let provider = (contract as any).provider
      if (!provider && signer && typeof (signer as any).provider !== 'undefined') {
        provider = (signer as any).provider
      }

      if (!provider) {
        throw new Error('Provider not available for fallback estimation')
      }

      const estimatedGas = await provider.estimateGas(estimationRequest)
      const gasWithBuffer = this.applyGasBuffer(estimatedGas, options)
      this.logger.log(`Fallback provider estimation successful: ${estimatedGas} -> ${gasWithBuffer} (with buffer)`)
      return gasWithBuffer
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Fallback provider gas estimation failed: ${errorMessage}`)

      // Step 3: Use fallback gas limit as last resort
      const fallbackGas = options.fallbackGasLimit || BigInt(500000)
      const gasWithBuffer = this.applyGasBuffer(fallbackGas, options)
      this.logger.warn(`Using fallback gas limit: ${fallbackGas} -> ${gasWithBuffer} (with buffer)`)
      return gasWithBuffer
    }
  }

  private async estimateGasWithBuffer(
    txData: TransactionData,
    wallet: ethers.NonceManager,
    options: TransactionOptions
  ): Promise<bigint> {
    try {
      const provider = wallet.provider
      if (!provider) {
        throw new Error('Provider not available')
      }
      const estimatedGas = await provider.estimateGas(txData as EthersTransactionRequest)
      return this.applyGasBuffer(estimatedGas, options)
    } catch (error) {
      this.logger.warn(`Gas estimation failed, using fallback: ${error}`)
      const fallbackGas = options.fallbackGasLimit || BigInt(500000)
      return this.applyGasBuffer(fallbackGas, options)
    }
  }

  // Private helper methods for gas price (new)

  /**
   * Retrieve base fee information from the provider
   * Used for multiplier-based gas price protection
   * @param provider Ethereum provider instance
   * @returns Base fee per gas in wei, or undefined if unavailable
   */
  private async getBaseFeePerGas(provider: ethers.Provider): Promise<bigint | undefined> {
    try {
      const feeData = await provider.getFeeData()
      // For EIP-1559 networks, use gasPrice from feeData as base reference
      // For legacy networks, this will be the network's current gas price
      return feeData.gasPrice || undefined
    } catch (error) {
      this.logger.warn(`Failed to get base fee: ${error}`)
      return undefined
    }
  }

  /**
   * Apply buffer to gas price to handle network volatility
   * @param gasPrice Base gas price to buffer
   * @param bufferPercentage Percentage buffer to apply (default: 10%)
   * @returns Buffered gas price
   */
  private applyGasPriceBuffer(gasPrice: bigint, bufferPercentage = this.DEFAULT_GAS_PRICE_BUFFER_PERCENTAGE): bigint {
    const buffer = (gasPrice * BigInt(bufferPercentage)) / BigInt(100)
    const bufferedPrice = gasPrice + buffer

    this.logger.log(`Gas price buffering - Original: ${gasPrice}, Buffer: ${buffer}, Final: ${bufferedPrice}`)
    return bufferedPrice
  }

  /**
   * Get optimal gas price for the network
   * Supports both legacy and EIP-1559 transactions with multiplier-based protection
   * @param wallet NonceManager instance with provider
   * @param options Transaction options with gas price preferences
   * @returns Gas price configuration object
   */
  private async getOptimalGasPrice(
    wallet: ethers.NonceManager,
    options: TransactionOptions
  ): Promise<{
    gasPrice?: bigint
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
  }> {
    const provider = wallet.provider
    if (!provider) {
      throw new Error('Provider not available for gas price estimation')
    }

    // Get base fee for multiplier-based protection
    const baseFeePerGas = await this.getBaseFeePerGas(provider)

    // Step 1: Check if EIP-1559 values provided explicitly
    if (options.maxFeePerGas && options.maxPriorityFeePerGas) {
      this.logger.log('Using provided EIP-1559 gas price values')
      const bufferedMaxFee = this.applyGasPriceBuffer(options.maxFeePerGas, options.gasPriceBufferPercentage)

      return {
        maxFeePerGas: await this.enforceMaxGasPrice(bufferedMaxFee, options, baseFeePerGas),
        maxPriorityFeePerGas: options.maxPriorityFeePerGas, // Usually don't buffer priority fee
      }
    }

    // Step 2: Check if legacy gas price provided explicitly
    if (options.gasPrice) {
      this.logger.log('Using provided legacy gas price')
      const bufferedPrice = this.applyGasPriceBuffer(options.gasPrice, options.gasPriceBufferPercentage)

      return {
        gasPrice: await this.enforceMaxGasPrice(bufferedPrice, options, baseFeePerGas),
      }
    }

    // Step 3: Fetch from provider

    try {
      this.logger.log('Fetching gas price from provider')
      const feeData = await provider.getFeeData()

      // Prefer EIP-1559 if supported
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        this.logger.log('Using EIP-1559 gas price from provider')
        const bufferedMaxFee = this.applyGasPriceBuffer(feeData.maxFeePerGas, options.gasPriceBufferPercentage)

        return {
          maxFeePerGas: await this.enforceMaxGasPrice(bufferedMaxFee, options, baseFeePerGas),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        }
      }

      // Fallback to legacy gas price
      if (feeData.gasPrice) {
        this.logger.log('Using legacy gas price from provider')
        const bufferedPrice = this.applyGasPriceBuffer(feeData.gasPrice, options.gasPriceBufferPercentage)

        return {
          gasPrice: await this.enforceMaxGasPrice(bufferedPrice, options, baseFeePerGas),
        }
      }

      throw new Error('No gas price data available from provider')
    } catch (error) {
      this.logger.warn(`Gas price estimation from provider failed: ${error}`)

      // Use fallback gas price if provided
      if (options.fallbackGasPrice) {
        this.logger.log('Using fallback gas price')
        const bufferedPrice = this.applyGasPriceBuffer(options.fallbackGasPrice, options.gasPriceBufferPercentage)

        return {
          gasPrice: await this.enforceMaxGasPrice(bufferedPrice, options, baseFeePerGas),
        }
      }

      throw new Error('Unable to determine gas price and no fallback provided')
    }
  }

  /**
   * Enforce maximum gas price limits to prevent excessive costs
   * Applies both user-provided limits and multiplier-based protection
   * @param gasPrice Gas price to check
   * @param options Transaction options with max gas price limit
   * @param baseFeePerGas Base fee for multiplier-based protection (optional)
   * @returns Gas price within limits
   */
  private async enforceMaxGasPrice(
    gasPrice: bigint,
    options: TransactionOptions,
    baseFeePerGas?: bigint
  ): Promise<bigint> {
    let cappedPrice = gasPrice

    // First apply user-provided max gas price limit
    if (options.maxGasPrice && cappedPrice > options.maxGasPrice) {
      this.handleGasPriceCapError(cappedPrice, options.maxGasPrice, 'user-max')
      cappedPrice = options.maxGasPrice
    }

    // Then apply multiplier-based protection if base fee is available
    if (baseFeePerGas) {
      const maxAllowedGasPrice = baseFeePerGas * BigInt(this.DEFAULT_MAX_GAS_PRICE_MULTIPLIER)
      if (cappedPrice > maxAllowedGasPrice) {
        this.handleGasPriceCapError(cappedPrice, maxAllowedGasPrice, 'multiplier-max', baseFeePerGas)
        cappedPrice = maxAllowedGasPrice
      }
    }

    return cappedPrice
  }

  /**
   * Handle gas price capping scenarios with detailed logging
   * @param originalPrice Original gas price before capping
   * @param cappedPrice Gas price after capping
   * @param reason Reason for capping (user-max or multiplier-max)
   * @param baseFee Base fee (optional, for multiplier-max context)
   */
  private handleGasPriceCapError(
    originalPrice: bigint,
    cappedPrice: bigint,
    reason: 'user-max' | 'multiplier-max',
    baseFee?: bigint
  ): void {
    const reduction = originalPrice - cappedPrice
    const percentageReduction = (reduction * BigInt(100)) / originalPrice

    let logMessage = `Gas price reduced by ${reduction} (${percentageReduction}%) due to ${reason} limit. `
    logMessage += `Original: ${originalPrice}, Capped: ${cappedPrice}`

    if (reason === 'multiplier-max' && baseFee) {
      logMessage += `, Base Fee: ${baseFee}, Multiplier: ${this.DEFAULT_MAX_GAS_PRICE_MULTIPLIER}x`
    }

    this.logger.warn(logMessage)
  }

  private isGasRelatedError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || ''
    const errorCode = error?.code

    const gasErrorPatterns = [
      'out of gas',
      'gas limit',
      'gas required exceeds allowance',
      'intrinsic gas too low',
      'insufficient gas',
    ]

    const hasGasKeyword = gasErrorPatterns.some((pattern) => errorMessage.includes(pattern))

    const gasErrorCodes = ['INSUFFICIENT_FUNDS', 'UNPREDICTABLE_GAS_LIMIT']

    const hasGasErrorCode = gasErrorCodes.includes(errorCode)

    return hasGasKeyword || hasGasErrorCode
  }

  /**
   * Check if error is specifically related to gas price issues
   * @param error Error object to analyze
   * @returns True if error is gas price related
   */
  private isGasPriceRelatedError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || ''

    const gasPriceErrorPatterns = [
      'gas price too low',
      'replacement transaction underpriced',
      'transaction underpriced',
      'max fee per gas less than block base fee',
      'max priority fee per gas higher than max fee per gas',
      'underpriced',
    ]

    return gasPriceErrorPatterns.some((pattern) => errorMessage.includes(pattern))
  }
}
