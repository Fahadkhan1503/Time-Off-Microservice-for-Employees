import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncLog } from './entities/sync-log.entity';
import { SyncService } from './sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([SyncLog])],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}