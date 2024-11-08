import { ReqService } from '@bitfi-mock-pmm/req';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { IResponse, Token, TokenPrice } from './type';

@Injectable()
export class TokenRepository {
  private readonly PRICE_CACHE_KEY = 'token-price:';
  private readonly TOKENS_CACHE_KEY = 'tokens-list';
  private readonly PRICE_CACHE_TTL = 60 * 1000;
  private readonly TOKENS_CACHE_TTL = 5 * 60 * 1000;

  constructor(
    @Inject('TOKEN_REQ_SERVICE')
    private readonly reqService: ReqService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  private async getTokensList(): Promise<Token[]> {
    let tokens = await this.cacheManager.get<Token[]>(this.TOKENS_CACHE_KEY);

    if (tokens) {
      return tokens;
    }

    try {
      const response = await this.reqService.get<IResponse<Token[]>>({
        url: '/tokens',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      tokens = response.data;

      await this.cacheManager.set(
        this.TOKENS_CACHE_KEY,
        tokens,
        this.TOKENS_CACHE_TTL
      );

      return tokens;
    } catch (error: any) {
      throw new Error(`Failed to fetch tokens list: ${error.message}`);
    }
  }

  async getToken(networkId: string, tokenAddress: string) {
    const tokens = await this.getTokensList();
    const token = tokens.find(
      (t) => t.networkId === networkId && t.tokenAddress === tokenAddress
    );

    if (!token) {
      throw new NotFoundException(
        `Token with networkId ${networkId} and tokenAddress ${tokenAddress} not found`
      );
    }

    return token;
  }

  async getTokenByTokenId(tokenId: string): Promise<Token> {
    const tokens = await this.getTokensList();
    const token = tokens.find((t) => t.tokenId === tokenId);

    if (!token) {
      throw new NotFoundException(`Token with tokenId ${tokenId} not found`);
    }

    return token;
  }

  /**
   * Get token price by symbol
   * @param symbol Token symbol (e.g., 'btc', 'eth')
   * @returns Token price information
   */
  async getTokenPrice(symbol: string): Promise<TokenPrice> {
    if (symbol === 'tBTC') {
      symbol = 'BTC';
    }

    const cacheKey = `${this.PRICE_CACHE_KEY}${symbol.toLowerCase()}`;

    let tokenPrice = await this.cacheManager.get<TokenPrice>(cacheKey);

    if (!tokenPrice) {
      try {
        const response = await this.reqService.get<IResponse<TokenPrice>>({
          url: `/tokens/${symbol.toLowerCase()}`,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        tokenPrice = response.data;

        await this.cacheManager.set(cacheKey, tokenPrice, this.PRICE_CACHE_TTL);
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw new NotFoundException(`Price not found for token ${symbol}`);
        }

        throw new Error(
          `Failed to fetch price for token ${symbol}: ${error.message}`
        );
      }
    }

    return tokenPrice;
  }
}
