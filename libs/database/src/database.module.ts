import { Module } from '@nestjs/common'
import { CustomConfigModule } from '@optimex-pmm/custom-config'

import { DatabaseService } from './database.service'

@Module({
  imports: [CustomConfigModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
