import dedent from 'dedent'

/**
 * Formats satoshis to BTC with proper decimals
 */
export function formatSatsToBtc(sats: string | bigint): string {
  const satsBigInt = typeof sats === 'string' ? BigInt(sats) : sats
  const btc = Number(satsBigInt) / 100_000_000
  return btc.toFixed(8)
}

/**
 * Formats USDC micro-units to human readable
 */
export function formatUsdc(microUsdc: string): string {
  const usdc = Number(BigInt(microUsdc)) / 1_000_000
  return usdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

/**
 * Rebalancing Notification Formatter
 * Uses dedent for clean multi-line messages with emojis and HTML formatting
 */
export const RebalanceNotification = {
  /**
   * Notification when quote is accepted and transfer is queued
   */
  quoteAccepted(params: {
    rebalancingId: string
    tradeHash: string
    depositAddress: string
    realAmount: string
    expectedUsdc: string
    slippageBps: number
  }): string {
    return dedent`
      ✅ <b>Quote Accepted</b>

      🔁 <b>ID:</b> <code>${params.rebalancingId}</code>
      📋 <b>Trade:</b> <code>${params.tradeHash}</code>
      📍 <b>Deposit:</b> <code>${params.depositAddress}</code>
      💰 <b>Amount:</b> ${formatSatsToBtc(params.realAmount)} BTC (${params.realAmount} sats)
      💵 <b>Expected:</b> $${formatUsdc(params.expectedUsdc)} USDC
      📊 <b>Slippage:</b> ${(params.slippageBps / 100).toFixed(2)}%

      ⏳ Transfer queued...
    `
  },

  /**
   * Notification when slippage exceeds threshold
   */
  slippageExceeded(params: {
    rebalancingId: string
    tradeHash: string
    slippageBps: number
    thresholdBps: number
  }): string {
    return dedent`
      ⚠️ <b>Slippage Exceeded</b>

      🔁 <b>ID:</b> <code>${params.rebalancingId}</code>
      📋 <b>Trade:</b> <code>${params.tradeHash}</code>
      📊 <b>Slippage:</b> ${(params.slippageBps / 100).toFixed(2)}%
      🎯 <b>Threshold:</b> ${(params.thresholdBps / 100).toFixed(2)}%

      🔄 Will retry when price improves
    `
  },

  /**
   * Notification when BTC is transferred to NEAR vault
   */
  btcTransferred(params: {
    rebalancingId: string
    tradeHash: string
    realAmount: string
    depositAddress: string
    txId: string
  }): string {
    return dedent`
      📤 <b>BTC Transferred to NEAR</b>

      🔁 <b>ID:</b> <code>${params.rebalancingId}</code>
      📋 <b>Trade:</b> <code>${params.tradeHash}</code>
      💰 <b>Amount:</b> ${formatSatsToBtc(params.realAmount)} BTC
      📍 <b>Deposit:</b> <code>${params.depositAddress}</code>
      🔗 <b>TX:</b> <code>${params.txId}</code>

      ⏳ Waiting for NEAR swap...
    `
  },

  /**
   * Notification when BTC transfer fails
   */
  btcTransferFailed(params: { rebalancingId: string; tradeHash: string; error: string }): string {
    return dedent`
      ❌ <b>BTC Transfer Failed</b>

      🔁 <b>ID:</b> <code>${params.rebalancingId}</code>
      📋 <b>Trade:</b> <code>${params.tradeHash}</code>
      ⚠️ <b>Error:</b> ${params.error}

      🔄 Will retry transfer
    `
  },

  /**
   * Notification when rebalancing completes successfully
   */
  completed(params: { rebalancingId: string; tradeId: string; usdcAmount: string; txHash?: string }): string {
    return dedent`
      🎉 <b>Rebalancing Completed!</b>

      🔁 <b>ID:</b> <code>${params.rebalancingId}</code>
      📋 <b>Trade:</b> <code>${params.tradeId}</code>
      💵 <b>USDC Received:</b> $${formatUsdc(params.usdcAmount)}
      🔗 <b>TX:</b> <code>${params.txHash || 'N/A'}</code>

      ✅ Swap successful!
    `
  },

  /**
   * Notification when NEAR swap fails
   */
  swapFailed(params: { rebalancingId: string; tradeId: string }): string {
    return dedent`
      ❌ <b>NEAR Swap Failed</b>

      🔁 <b>ID:</b> <code>${params.rebalancingId}</code>
      📋 <b>Trade:</b> <code>${params.tradeId}</code>

      🔄 Will retry later
    `
  },

  /**
   * Notification when funds are refunded (critical)
   */
  refunded(params: { rebalancingId: string; tradeId: string; refundedAmount?: string }): string {
    return dedent`
      🚨 <b>CRITICAL: Unexpected Refund</b>

      🔁 <b>ID:</b> <code>${params.rebalancingId}</code>
      📋 <b>Trade:</b> <code>${params.tradeId}</code>
      💸 <b>Refunded:</b> ${params.refundedAmount || 'N/A'}

      ⚠️ <b>Manual intervention required!</b>
    `
  },

  /**
   * Notification when rebalancing is stuck (critical)
   */
  stuck(params: {
    rebalancingId: string
    tradeId: string
    elapsedHours: number
    maxHours: number
    lastError?: string
  }): string {
    return dedent`
      🚨 <b>CRITICAL: Rebalancing Stuck</b>

      🔁 <b>ID:</b> <code>${params.rebalancingId}</code>
      📋 <b>Trade:</b> <code>${params.tradeId}</code>
      ⏱️ <b>Elapsed:</b> ${params.elapsedHours}h (max: ${params.maxHours}h)
      ⚠️ <b>Last Error:</b> ${params.lastError || 'N/A'}

      🔧 <b>Manual intervention required!</b>
    `
  },

  /**
   * Notification when quote request fails
   */
  quoteFailed(params: { tradeHash: string; error: string }): string {
    return dedent`
      ❌ <b>Quote Request Failed</b>

      📋 <b>Trade:</b> <code>${params.tradeHash}</code>
      ⚠️ <b>Error:</b> ${params.error}
    `
  },
}
