import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { CollectionController } from './collection.controller.js';
import { CollectionService } from './collection.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class CollectionModule {}
