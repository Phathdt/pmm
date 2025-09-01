export interface NotificationProvider {
  /**
   * Send a message through the notification provider
   * @param message The message content to send
   * @param options Additional provider-specific options
   */
  sendMessage(message: string, options?: Record<string, any>): Promise<void>

  /**
   * Validate if the provider is properly configured
   * @returns true if configuration is valid, false otherwise
   */
  validateConfiguration(): boolean

  /**
   * Get the provider name/type identifier
   */
  readonly providerName: string
}
