import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncLog } from './entities/sync-log.entity';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncLog)
    private syncLogRepo: Repository<SyncLog>,
  ) {}

  async getLogs(): Promise<SyncLog[]> {
    return this.syncLogRepo.find({ order: { createdAt: 'DESC' } });
  }
}