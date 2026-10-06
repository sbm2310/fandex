import {
  slugSchema,
  universeDetailSchema,
  universeSummarySchema,
  type UniverseDetail,
  type UniverseListResponse,
} from '@fandex/core';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { PrismaService } from '../prisma/prisma.service.js';

/** Public: the universes Fandex knows and their characters (the same for everyone). */
@ApiTags('universes')
@AllowAnonymous()
@Controller('universes')
export class UniversesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ description: 'Every universe, in a stable order.' })
  async list(): Promise<UniverseListResponse> {
    const rows = await this.prisma.universe.findMany({ orderBy: { position: 'asc' } });
    return { universes: rows.map((row) => universeSummarySchema.parse(row)) };
  }

  @Get(':slug')
  @ApiOkResponse({ description: 'The universe with its characters.' })
  @ApiBadRequestResponse({ description: 'Not a valid slug.' })
  @ApiNotFoundResponse({ description: 'No such universe.' })
  async detail(@Param('slug', { schema: slugSchema }) slug: string): Promise<UniverseDetail> {
    const row = await this.prisma.universe.findUnique({
      where: { slug },
      include: { characters: { orderBy: { position: 'asc' } } },
    });
    if (!row) throw new NotFoundException(`No universe "${slug}"`);
    // Parsing picks the public fields (no database ids, positions or aliases).
    return universeDetailSchema.parse(row);
  }
}
