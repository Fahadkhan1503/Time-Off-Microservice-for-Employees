import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalance } from './entities/leave-balance.entity';
import { SyncLog } from '../sync/entities/sync-log.entity';
import { HcmService } from '../hcm/hcm.service';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncType, SyncStatus } from '../common/enums/sync-type.enum';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @InjectRepository(LeaveBalance)
    private balanceRepo: Repository<LeaveBalance>,
    @InjectRepository(SyncLog)
    private syncLogRepo: Repository<SyncLog>,
    private hcmService: HcmService,
  ) {}

  async getBalancesByEmployee(employeeId: string): Promise<LeaveBalance[]> {
    return this.balanceRepo.find({ where: { employeeId } });
  }

  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<LeaveBalance | null> {
    return this.balanceRepo.findOne({ where: { employeeId, locationId } });
  }

  async syncRealtime(
    employeeId: string,
    locationId: string,
  ): Promise<LeaveBalance> {
    const totalDays = await this.hcmService.getBalance(employeeId, locationId);

    let balance = await this.balanceRepo.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      balance = this.balanceRepo.create({
        employeeId,
        locationId,
        totalDays,
        usedDays: 0,
        pendingDays: 0,
      });
    } else {
      balance.totalDays = totalDays;
    }

    balance.lastSyncedAt = new Date();
    await this.balanceRepo.save(balance);

    await this.syncLogRepo.save({
      syncType: SyncType.REALTIME_INBOUND,
      status: SyncStatus.SUCCESS,
      recordsProcessed: 1,
    });

    return balance;
  }

  async syncBatch(
    dto: SyncBatchDto,
  ): Promise<{
    processed: number;
    updated: number;
    unchanged: number;
    errors: any[];
  }> {
    let updated = 0;
    let unchanged = 0;
    const errors: any[] = [];

    for (const record of dto.records) {
      try {
        let balance = await this.balanceRepo.findOne({
          where: {
            employeeId: record.employeeId,
            locationId: record.locationId,
          },
        });

        if (!balance) {
          balance = this.balanceRepo.create({
            employeeId: record.employeeId,
            locationId: record.locationId,
            totalDays: record.totalDays,
            usedDays: 0,
            pendingDays: 0,
          });
          await this.balanceRepo.save(balance);
          updated++;
        } else if (Number(balance.totalDays) !== Number(record.totalDays)) {
          balance.totalDays = record.totalDays;
          balance.lastSyncedAt = new Date();
          await this.balanceRepo.save(balance);
          updated++;
        } else {
          unchanged++;
        }
      } catch (error: any) {
        errors.push({ record, error: error.message });
      }
    }

    await this.syncLogRepo.save({
      syncType: SyncType.BATCH_INBOUND,
      status: errors.length === 0 ? SyncStatus.SUCCESS : SyncStatus.PARTIAL,
      recordsProcessed: dto.records.length,
      errorDetails: errors.length > 0 ? JSON.stringify(errors) : undefined,
    });

    return { processed: dto.records.length, updated, unchanged, errors };
  }
}
