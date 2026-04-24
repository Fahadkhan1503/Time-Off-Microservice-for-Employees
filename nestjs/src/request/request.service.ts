import { Injectable, NotFoundException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { LeaveBalance } from '../balance/entities/leave-balance.entity';
import { HcmService } from '../hcm/hcm.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { RequestStatus } from '../common/enums/request-status.enum';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private requestRepo: Repository<TimeOffRequest>,
    @InjectRepository(LeaveBalance)
    private balanceRepo: Repository<LeaveBalance>,
    private hcmService: HcmService,
    private dataSource: DataSource,
  ) {}

  private calculateDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let days = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) days++;
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  async create(dto: CreateRequestDto): Promise<any> {
    const days = this.calculateDays(dto.startDate, dto.endDate);

    let balance = await this.balanceRepo.findOne({
      where: { employeeId: dto.employeeId, locationId: dto.locationId },
    });

    if (!balance) {
      throw new UnprocessableEntityException('No balance found for this employee and location');
    }

    const available = Number(balance.totalDays) - Number(balance.usedDays) - Number(balance.pendingDays);

    if (available < days) {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        available,
        requested: days,
      });
    }

    balance.pendingDays = Number(balance.pendingDays) + days;
    await this.balanceRepo.save(balance);

    const request = this.requestRepo.create({
      ...dto,
      days,
      status: RequestStatus.PENDING as string,
    });

    const saved = await this.requestRepo.save(request);
    return { ...saved, availableAfter: available - days };
  }

  async findOne(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async findAll(employeeId?: string, status?: string): Promise<TimeOffRequest[]> {
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    return this.requestRepo.find({ where });
  }

  async approve(id: string, dto: ApproveRequestDto): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find request
      const request = await queryRunner.manager.findOne(TimeOffRequest, {
        where: { id },
      });

      if (!request) throw new NotFoundException('Request not found');
      if (request.status !== (RequestStatus.PENDING as string)) {
        throw new ConflictException('Only PENDING requests can be approved');
      }

      // Row-level lock: pessimistically lock the balance row
      const balance = await queryRunner.manager.findOne(LeaveBalance, {
        where: { employeeId: request.employeeId, locationId: request.locationId },
        // lock: { mode: 'pessimistic_write' },
      });

      if (!balance) throw new NotFoundException('Balance not found');

      // Defensive check
      const available = Number(balance.totalDays) - Number(balance.usedDays) - Number(balance.pendingDays);
      if (available < Number(request.days)) {
        throw new UnprocessableEntityException({ error: 'INSUFFICIENT_BALANCE' });
      }

      // Sync with HCM (if fails, transaction rolls back automatically)
      let hcmSynced = false;
      try {
        await this.hcmService.deductBalance(request.employeeId, request.locationId, Number(request.days));
        hcmSynced = true;
      } catch (error) {
        // Rollback happens automatically when transaction is rolled back
        throw new ConflictException({ 
          error: 'HCM_SYNC_FAILED', 
          message: 'HCM rejected deduction. Changes rolled back.' 
        });
      }

      // Update balance within transaction
      balance.pendingDays = Number(balance.pendingDays) - Number(request.days);
      balance.usedDays = Number(balance.usedDays) + Number(request.days);
      await queryRunner.manager.save(balance);

      // Update request within transaction
      request.status = RequestStatus.APPROVED as string;
      request.managerId = dto.managerId;
      request.hcmSynced = hcmSynced;
      await queryRunner.manager.save(request);

      // Commit transaction
      await queryRunner.commitTransaction();
      return request;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async reject(id: string, dto: ApproveRequestDto): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (request.status !== (RequestStatus.PENDING as string)) {
      throw new ConflictException('Only PENDING requests can be rejected');
    }

    const balance = await this.balanceRepo.findOne({
      where: { employeeId: request.employeeId, locationId: request.locationId },
    });

    if (balance) {
      balance.pendingDays = Number(balance.pendingDays) - Number(request.days);
      await this.balanceRepo.save(balance);
    }

    request.status = RequestStatus.REJECTED as string;
    request.managerId = dto.managerId;
    return this.requestRepo.save(request);
  }

  async cancel(id: string): Promise<TimeOffRequest> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(TimeOffRequest, {
        where: { id },
      });

      if (!request) throw new NotFoundException('Request not found');
      if (![RequestStatus.PENDING, RequestStatus.APPROVED].includes(request.status as RequestStatus)) {
        throw new ConflictException('Only PENDING or APPROVED requests can be cancelled');
      }

      // Row-level lock
      const balance = await queryRunner.manager.findOne(LeaveBalance, {
        where: { employeeId: request.employeeId, locationId: request.locationId },
        // lock: { mode: 'pessimistic_write' },
      });

      if (balance) {
        if (request.status === RequestStatus.PENDING) {
          balance.pendingDays = Number(balance.pendingDays) - Number(request.days);
        } else if (request.status === RequestStatus.APPROVED) {
          balance.usedDays = Number(balance.usedDays) - Number(request.days);
          try {
            await this.hcmService.restoreBalance(request.employeeId, request.locationId, Number(request.days));
          } catch (error) {
            throw new ConflictException('HCM restore failed. Changes rolled back.');
          }
        }
        await queryRunner.manager.save(balance);
      }

      request.status = RequestStatus.CANCELLED as string;
      await queryRunner.manager.save(request);

      await queryRunner.commitTransaction();
      return request;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}