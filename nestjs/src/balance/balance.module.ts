import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';
import { HcmModule } from '../hcm/hcm.module';
import { SyncLog } from '../sync/entities/sync-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveBalance, SyncLog]), HcmModule],
  providers: [BalanceService],
  controllers: [BalanceController],
  exports: [BalanceService],
})
export class BalanceModule {}