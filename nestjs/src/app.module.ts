import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { BalanceModule } from './balance/balance.module';
import { RequestModule } from './request/request.module';
import { HcmModule } from './hcm/hcm.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    DatabaseModule,
    HcmModule,
    BalanceModule,
    RequestModule,
    SyncModule,
  ],
})
export class AppModule {}