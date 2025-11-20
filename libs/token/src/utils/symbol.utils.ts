/**
 * Normalizes token symbols to their canonical form
 * Maps wrapped tokens and variants to their base token symbol
 *
 * @param symbol - The token symbol to normalize
 * @returns The normalized token symbol in uppercase
 *
 * @example
 * normalizeSymbol('WETH') // returns 'ETH'
 * normalizeSymbol('tbtc') // returns 'BTC'
 * normalizeSymbol('wsol') // returns 'SOL'
 */
export function normalizeSymbol(symbol: string): string {
  switch (symbol.toUpperCase()) {
    case 'TBTC':
    case 'WBTC':
      return 'BTC'
    case 'WETH':
      return 'ETH'
    case 'WSOL':
      return 'SOL'
    default:
      return symbol.toUpperCase()
  }
}
