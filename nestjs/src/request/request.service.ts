import { Injectable, NotFoundException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      status: RequestStatus.PENDING,
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
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('Only PENDING requests can be approved');
    }

    const balance = await this.balanceRepo.findOne({
      where: { employeeId: request.employeeId, locationId: request.locationId },
    });

    if (!balance) throw new NotFoundException('Balance not found');

    // Defensive check
    const available = Number(balance.totalDays) - Number(balance.usedDays) - Number(balance.pendingDays);
    if (available + Number(request.days) < Number(request.days)) {
      throw new UnprocessableEntityException({ error: 'INSUFFICIENT_BALANCE' });
    }

    // Sync with HCM
    let hcmSynced = false;
    try {
      await this.hcmService.deductBalance(request.employeeId, request.locationId, Number(request.days));
      hcmSynced = true;
    } catch {
      throw new ConflictException({ error: 'HCM_SYNC_FAILED', message: 'HCM rejected deduction' });
    }

    balance.pendingDays = Number(balance.pendingDays) - Number(request.days);
    balance.usedDays = Number(balance.usedDays) + Number(request.days);
    await this.balanceRepo.save(balance);

    request.status = RequestStatus.APPROVED;
    request.managerId = dto.managerId;
    request.hcmSynced = hcmSynced;
    const saved = await this.requestRepo.save(request);

    return saved;
  }

  async reject(id: string, dto: ApproveRequestDto): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException('Only PENDING requests can be rejected');
    }

    const balance = await this.balanceRepo.findOne({
      where: { employeeId: request.employeeId, locationId: request.locationId },
    });

    if (balance) {
      balance.pendingDays = Number(balance.pendingDays) - Number(request.days);
      await this.balanceRepo.save(balance);
    }

    request.status = RequestStatus.REJECTED;
    request.managerId = dto.managerId;
    return this.requestRepo.save(request);
  }

  async cancel(id: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (![RequestStatus.PENDING, RequestStatus.APPROVED].includes(request.status)) {
      throw new ConflictException('Only PENDING or APPROVED requests can be cancelled');
    }

    const balance = await this.balanceRepo.findOne({
      where: { employeeId: request.employeeId, locationId: request.locationId },
    });

    if (balance) {
      if (request.status === RequestStatus.PENDING) {
        balance.pendingDays = Number(balance.pendingDays) - Number(request.days);
      } else if (request.status === RequestStatus.APPROVED) {
        balance.usedDays = Number(balance.usedDays) - Number(request.days);
        try {
          await this.hcmService.restoreBalance(request.employeeId, request.locationId, Number(request.days));
        } catch {
          throw new ConflictException('HCM restore failed');
        }
      }
      await this.balanceRepo.save(balance);
    }

    request.status = RequestStatus.CANCELLED;
    return this.requestRepo.save(request);
  }
}