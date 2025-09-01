export interface SendMessageDto {
  /**
   * Unique identifier for the target chat
   */
  chat_id: string | number

  /**
   * Text of the message to be sent, 1-4096 characters after entities parsing
   */
  text: string

  /**
   * Mode for parsing entities in the message text
   */
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'

  /**
   * Sends the message silently. Users will receive a notification with no sound
   */
  disable_notification?: boolean

  /**
   * Protects the contents of the sent message from forwarding and saving
   */
  protect_content?: boolean

  /**
   * If the message is a reply, ID of the original message
   */
  reply_to_message_id?: number

  /**
   * Pass True if the message should be sent even if the specified replied-to message is not found
   */
  allow_sending_without_reply?: boolean
}
