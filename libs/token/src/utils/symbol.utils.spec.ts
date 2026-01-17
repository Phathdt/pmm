import { describe, expect, it } from 'vitest'

import { normalizeSymbol } from './symbol.utils'

describe('normalizeSymbol', () => {
  describe('Wrapped BTC variants', () => {
    it('should normalize WBTC to BTC', () => {
      expect(normalizeSymbol('WBTC')).toBe('BTC')
    })

    it('should normalize wbtc (lowercase) to BTC', () => {
      expect(normalizeSymbol('wbtc')).toBe('BTC')
    })

    it('should normalize TBTC to BTC', () => {
      expect(normalizeSymbol('TBTC')).toBe('BTC')
    })

    it('should normalize tbtc (lowercase) to BTC', () => {
      expect(normalizeSymbol('tbtc')).toBe('BTC')
    })
  })

  describe('Wrapped ETH variants', () => {
    it('should normalize WETH to ETH', () => {
      expect(normalizeSymbol('WETH')).toBe('ETH')
    })

    it('should normalize weth (lowercase) to ETH', () => {
      expect(normalizeSymbol('weth')).toBe('ETH')
    })
  })

  describe('Wrapped SOL variants', () => {
    it('should normalize WSOL to SOL', () => {
      expect(normalizeSymbol('WSOL')).toBe('SOL')
    })

    it('should normalize wsol (lowercase) to SOL', () => {
      expect(normalizeSymbol('wsol')).toBe('SOL')
    })
  })

  describe('Regular tokens', () => {
    it('should uppercase BTC', () => {
      expect(normalizeSymbol('btc')).toBe('BTC')
    })

    it('should uppercase ETH', () => {
      expect(normalizeSymbol('eth')).toBe('ETH')
    })

    it('should uppercase SOL', () => {
      expect(normalizeSymbol('sol')).toBe('SOL')
    })

    it('should uppercase USDT', () => {
      expect(normalizeSymbol('usdt')).toBe('USDT')
    })

    it('should return already uppercase symbols as-is', () => {
      expect(normalizeSymbol('BTC')).toBe('BTC')
      expect(normalizeSymbol('ETH')).toBe('ETH')
      expect(normalizeSymbol('USDT')).toBe('USDT')
    })
  })

  describe('Unknown symbols', () => {
    it('should return unknown symbols as uppercase', () => {
      expect(normalizeSymbol('XYZ')).toBe('XYZ')
    })

    it('should uppercase unknown lowercase symbols', () => {
      expect(normalizeSymbol('xyz')).toBe('XYZ')
    })

    it('should handle mixed case unknown symbols', () => {
      expect(normalizeSymbol('AbCdEf')).toBe('ABCDEF')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(normalizeSymbol('')).toBe('')
    })

    it('should handle single character', () => {
      expect(normalizeSymbol('a')).toBe('A')
    })

    it('should handle symbols with numbers', () => {
      expect(normalizeSymbol('erc20')).toBe('ERC20')
    })
  })
})
