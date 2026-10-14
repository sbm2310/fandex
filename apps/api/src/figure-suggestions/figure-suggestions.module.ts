import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { AdminFigureSuggestionsController } from './admin-figure-suggestions.controller.js';
import { FigureSuggestionsController } from './figure-suggestions.controller.js';
import { FigureSuggestionsService } from './figure-suggestions.service.js';

@Module({
  imports: [AdminModule, CatalogModule],
  controllers: [FigureSuggestionsController, AdminFigureSuggestionsController],
  providers: [FigureSuggestionsService],
})
export class FigureSuggestionsModule {}
