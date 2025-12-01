import { QuoteSession, QuoteSessionCreateData } from '../entities'

export interface IQuoteSessionRepository {
  /**
   * Save a quote session to the cache
   * @param sessionId Unique session identifier
   * @param data Session data to save
   */
  save(sessionId: string, data: QuoteSessionCreateData): Promise<void>

  /**
   * Find a quote session by ID
   * @param sessionId The session ID to look up
   * @returns The session data or null if not found/expired
   */
  findById(sessionId: string): Promise<QuoteSession | null>

  /**
   * Delete a quote session
   * @param sessionId The session ID to delete
   */
  delete(sessionId: string): Promise<void>
}
