export interface IQueueService {
  /**
   * Push data to the specified queue
   * @param queueName The name of the queue
   * @param data The data to push to the queue
   * @returns Promise<number> The new length of the queue
   */
  pushToQueue(queueName: string, data: unknown): Promise<number>

  /**
   * Pop data from the specified queue
   * @param queueName The name of the queue
   * @param count The number of items to pop (default: 1)
   * @returns Promise<unknown[]> Array of popped items
   */
  popFromQueue(queueName: string, count?: number): Promise<unknown[]>

  /**
   * Get the current length of the specified queue
   * @param queueName The name of the queue
   * @returns Promise<number> The current queue length
   */
  getQueueLength(queueName: string): Promise<number>

  /**
   * Clear all items from the specified queue
   * @param queueName The name of the queue
   * @returns Promise<void>
   */
  clearQueue(queueName: string): Promise<void>
}
