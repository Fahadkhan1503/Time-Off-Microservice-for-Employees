import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { BalanceModule } from '../balance/balance.module';
import { HcmModule } from '../hcm/hcm.module';
import { LeaveBalance } from '../balance/entities/leave-balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TimeOffRequest, LeaveBalance]), BalanceModule, HcmModule],
  providers: [RequestService],
  controllers: [RequestController],
})
export class RequestModule {}