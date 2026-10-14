import { Module } from '@nestjs/common';

import { AdminModule } from '../admin/admin.module.js';
import { MeController } from './me.controller.js';

@Module({ imports: [AdminModule], controllers: [MeController] })
export class MeModule {}
