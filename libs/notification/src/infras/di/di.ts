// Symbol-based dependency injection tokens for better type safety
export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE')
export const TELEGRAM_PROVIDER = Symbol('TELEGRAM_PROVIDER')

// String-based token for ReqService dynamic registration
export const TELEGRAM_REQ_SERVICE = 'TELEGRAM_REQ_SERVICE'
