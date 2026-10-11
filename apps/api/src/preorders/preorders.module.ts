import { Module } from '@nestjs/common';

import { CollectionModule } from '../collection/collection.module.js';

import { PreordersController } from './preorders.controller.js';
import { PreordersService } from './preorders.service.js';

@Module({
  imports: [CollectionModule],
  controllers: [PreordersController],
  providers: [PreordersService],
})
export class PreordersModule {}
