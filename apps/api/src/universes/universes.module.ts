import { Module } from '@nestjs/common';

import { UniverseLinker } from './universe-linker.service.js';
import { UniverseSeedService } from './universe-seed.service.js';
import { UniversesController } from './universes.controller.js';

@Module({
  controllers: [UniversesController],
  providers: [UniverseLinker, UniverseSeedService],
  exports: [UniverseLinker],
})
export class UniversesModule {}
