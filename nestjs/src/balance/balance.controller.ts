import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { SyncBatchDto } from './dto/sync-batch.dto';

@Controller('api/v1/balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':employeeId')
  getByEmployee(@Param('employeeId') employeeId: string) {
    return this.balanceService.getBalancesByEmployee(employeeId);
  }

  @Get(':employeeId/:locationId')
  getOne(@Param('employeeId') employeeId: string, @Param('locationId') locationId: string) {
    return this.balanceService.getBalance(employeeId, locationId);
  }

  @Post('sync/batch')
  syncBatch(@Body() dto: SyncBatchDto) {
    return this.balanceService.syncBatch(dto);
  }

  @Post('sync/realtime/:employeeId/:locationId')
  syncRealtime(@Param('employeeId') employeeId: string, @Param('locationId') locationId: string) {
    return this.balanceService.syncRealtime(employeeId, locationId);
  }
}