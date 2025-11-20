import { Controller, Get } from '@nestjs/common'
import { PmmInfoResponseDto } from '@optimex-pmm/settlement'

import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async ping() {
    return { msg: 'pong' }
  }

  @Get('pmm-info')
  async getPmmInfo(): Promise<PmmInfoResponseDto> {
    return this.appService.getPmmInfo()
  }
}
