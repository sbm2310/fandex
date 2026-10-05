import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service.js';

export type HealthStatus = { status: 'ok'; database: 'up' };

/** Liveness check for local dev, CI and the hosting platform. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ description: 'The API and its database are up.' })
  @ApiServiceUnavailableResponse({ description: 'The database is unreachable.' })
  async check(): Promise<HealthStatus> {
    if (!(await this.prisma.isHealthy())) {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return { status: 'ok', database: 'up' };
  }
}
