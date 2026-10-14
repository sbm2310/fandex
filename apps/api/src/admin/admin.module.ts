import { Module } from '@nestjs/common';

import { AdminService } from './admin.service.js';

@Module({ providers: [AdminService], exports: [AdminService] })
export class AdminModule {}
