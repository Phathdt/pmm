import { Injectable } from '@nestjs/common'
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { config } from '@optimex-xyz/market-maker-sdk'

import axios from 'axios'

import { FeeEstimates, TransactionResponse, Utxo } from '../../domain'

@Injectable()
export class MempoolProvider {
  private readonly timeout: number
  private readonly baseUrl: string

  constructor(private readonly configService: CustomConfigService) {
    this.timeout = this.configService.bitcoin.timeoutMs
    this.baseUrl = config.isTestnet() ? 'https://mempool.space/testnet4/api' : 'https://mempool.space/api'
  }

  async getTransaction(txId: string): Promise<TransactionResponse> {
    const url = `${this.baseUrl}/tx/${txId}`
    const response = await axios.get<TransactionResponse>(url, { timeout: this.timeout })
    return response.data
  }

  async getUtxos(address: string): Promise<Utxo[]> {
    const url = `${this.baseUrl}/address/${address}/utxo`
    const response = await axios.get<Utxo[]>(url, { timeout: this.timeout })
    return response.data
  }

  async getFeeEstimates(): Promise<FeeEstimates> {
    const url = `${this.baseUrl}/fee-estimates`
    const response = await axios.get<FeeEstimates>(url, { timeout: this.timeout })
    return response.data
  }

  async broadcast(txHex: string): Promise<string> {
    const url = `${this.baseUrl}/tx`
    const response = await axios.post<string>(url, txHex, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: this.timeout,
    })
    return response.data
  }
}
