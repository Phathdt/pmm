/**
 * SDK Trade Event types for type-safe event processing.
 * These types represent the events returned by the Optimex SDK trade service.
 */

/**
 * Input data for ConfirmSettlement event containing BTC release transaction info
 */
export interface ConfirmSettlementInputData {
  release_tx_id?: string
  releaseTxId?: string
  [key: string]: unknown
}

/**
 * Base SDK trade event structure
 */
export interface SdkTradeEvent {
  action: string
  timestamp?: string | number
  txHash?: string
  inputData?: Record<string, unknown>
  input_data?: Record<string, unknown>
}

/**
 * ConfirmSettlement event with typed input data
 */
export interface ConfirmSettlementEvent {
  action: 'ConfirmSettlement'
  timestamp?: string | number
  txHash?: string
  inputData?: ConfirmSettlementInputData
  input_data?: ConfirmSettlementInputData
}

/**
 * Type guard to check if event is ConfirmSettlement
 */
export function isConfirmSettlementEvent(event: SdkTradeEvent): event is SdkTradeEvent & ConfirmSettlementEvent {
  return event.action === 'ConfirmSettlement'
}

/**
 * Extracts the BTC release transaction ID from a ConfirmSettlement event.
 * Handles both snake_case and camelCase naming conventions.
 *
 * @param event - The event with ConfirmSettlement action
 * @returns BTC transaction ID or null if not found
 */
export function extractReleaseTxIdFromEvent(event: SdkTradeEvent & ConfirmSettlementEvent): string | null {
  const inputData = (event.inputData || event.input_data) as ConfirmSettlementInputData | undefined
  if (!inputData) {
    return null
  }

  return inputData.release_tx_id || inputData.releaseTxId || null
}
