import { describe, expect, it } from 'vitest'

import { NotificationModule } from './notification.module'

describe('NotificationModule', () => {
  it('should be a global module', () => {
    // Test that the module is decorated with @Global()
    const isGlobalMetadata = Reflect.getMetadata('__module:global__', NotificationModule)
    expect(isGlobalMetadata).toBe(true)
  })

  it('should be defined', () => {
    expect(NotificationModule).toBeDefined()
  })
})
