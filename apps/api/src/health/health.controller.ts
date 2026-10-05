import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

export type HealthStatus = { status: 'ok' };

/** Liveness check for local dev, CI and the hosting platform. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'The API is up.' })
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
