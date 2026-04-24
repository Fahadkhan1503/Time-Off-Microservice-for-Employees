import { Test, TestingModule } from '@nestjs/testing';
import { RequestService } from '../../src/request/request.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimeOffRequest } from '../../src/request/entities/time-off-request.entity';
import { LeaveBalance } from '../../src/balance/entities/leave-balance.entity';
import { HcmService } from '../../src/hcm/hcm.service';
import { RequestStatus } from '../../src/common/enums/request-status.enum';
import { UnprocessableEntityException, ConflictException, NotFoundException } from '@nestjs/common';

const mockRequestRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockBalanceRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockHcmService = {
  deductBalance: jest.fn(),
  restoreBalance: jest.fn(),
};

describe('RequestService', () => {
  let service: RequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestService,
        { provide: getRepositoryToken(TimeOffRequest), useValue: mockRequestRepo },
        { provide: getRepositoryToken(LeaveBalance), useValue: mockBalanceRepo },
        { provide: HcmService, useValue: mockHcmService },
      ],
    }).compile();

    service = module.get<RequestService>(RequestService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a request with sufficient balance', async () => {
      mockBalanceRepo.findOne.mockResolvedValue({
        totalDays: 10, usedDays: 0, pendingDays: 0,
      });
      mockBalanceRepo.save.mockResolvedValue({});
      mockRequestRepo.create.mockReturnValue({ id: 'uuid1', days: 3, status: RequestStatus.PENDING });
      mockRequestRepo.save.mockResolvedValue({ id: 'uuid1', days: 3, status: RequestStatus.PENDING });

      const result = await service.create({
        employeeId: 'E001',
        locationId: 'LOC_KHI',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
      });

      expect(result.status).toBe(RequestStatus.PENDING);
      expect(mockBalanceRepo.save).toHaveBeenCalled();
    });

    it('should throw if balance not found', async () => {
      mockBalanceRepo.findOne.mockResolvedValue(null);

      await expect(service.create({
        employeeId: 'E999',
        locationId: 'LOC_KHI',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
      })).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw if insufficient balance', async () => {
      mockBalanceRepo.findOne.mockResolvedValue({
        totalDays: 2, usedDays: 0, pendingDays: 0,
      });

      await expect(service.create({
        employeeId: 'E001',
        locationId: 'LOC_KHI',
        startDate: '2026-05-01',
        endDate: '2026-05-07',
      })).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('approve', () => {
    it('should approve a pending request and sync with HCM', async () => {
      const request = { id: 'uuid1', status: RequestStatus.PENDING, employeeId: 'E001', locationId: 'LOC_KHI', days: 3 };
      mockRequestRepo.findOne.mockResolvedValue(request);
      mockBalanceRepo.findOne.mockResolvedValue({ totalDays: 10, usedDays: 0, pendingDays: 3 });
      mockHcmService.deductBalance.mockResolvedValue(true);
      mockBalanceRepo.save.mockResolvedValue({});
      mockRequestRepo.save.mockResolvedValue({ ...request, status: RequestStatus.APPROVED });

      const result = await service.approve('uuid1', { managerId: 'M001' });
      expect(result.status).toBe(RequestStatus.APPROVED);
      expect(mockHcmService.deductBalance).toHaveBeenCalledWith('E001', 'LOC_KHI', 3);
    });

    it('should throw if request is not PENDING', async () => {
      mockRequestRepo.findOne.mockResolvedValue({ status: RequestStatus.APPROVED });

      await expect(service.approve('uuid1', { managerId: 'M001' }))
        .rejects.toThrow(ConflictException);
    });

    it('should throw if HCM sync fails', async () => {
      const request = { id: 'uuid1', status: RequestStatus.PENDING, employeeId: 'E001', locationId: 'LOC_KHI', days: 3 };
      mockRequestRepo.findOne.mockResolvedValue(request);
      mockBalanceRepo.findOne.mockResolvedValue({ totalDays: 10, usedDays: 0, pendingDays: 3 });
      mockHcmService.deductBalance.mockRejectedValue(new Error('HCM down'));

      await expect(service.approve('uuid1', { managerId: 'M001' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('reject', () => {
    it('should reject a pending request and restore pendingDays', async () => {
      const request = { id: 'uuid1', status: RequestStatus.PENDING, employeeId: 'E001', locationId: 'LOC_KHI', days: 3 };
      mockRequestRepo.findOne.mockResolvedValue(request);
      mockBalanceRepo.findOne.mockResolvedValue({ totalDays: 10, usedDays: 0, pendingDays: 3 });
      mockBalanceRepo.save.mockResolvedValue({});
      mockRequestRepo.save.mockResolvedValue({ ...request, status: RequestStatus.REJECTED });

      const result = await service.reject('uuid1', { managerId: 'M001' });
      expect(result.status).toBe(RequestStatus.REJECTED);
    });

    it('should throw if request is not PENDING', async () => {
      mockRequestRepo.findOne.mockResolvedValue({ status: RequestStatus.APPROVED });
      await expect(service.reject('uuid1', { managerId: 'M001' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('should cancel a PENDING request', async () => {
      const request = { id: 'uuid1', status: RequestStatus.PENDING, employeeId: 'E001', locationId: 'LOC_KHI', days: 3 };
      mockRequestRepo.findOne.mockResolvedValue(request);
      mockBalanceRepo.findOne.mockResolvedValue({ totalDays: 10, usedDays: 0, pendingDays: 3 });
      mockBalanceRepo.save.mockResolvedValue({});
      mockRequestRepo.save.mockResolvedValue({ ...request, status: RequestStatus.CANCELLED });

      const result = await service.cancel('uuid1');
      expect(result.status).toBe(RequestStatus.CANCELLED);
    });

    it('should cancel an APPROVED request and restore HCM balance', async () => {
      const request = { id: 'uuid1', status: RequestStatus.APPROVED, employeeId: 'E001', locationId: 'LOC_KHI', days: 3 };
      mockRequestRepo.findOne.mockResolvedValue(request);
      mockBalanceRepo.findOne.mockResolvedValue({ totalDays: 10, usedDays: 3, pendingDays: 0 });
      mockHcmService.restoreBalance.mockResolvedValue(true);
      mockBalanceRepo.save.mockResolvedValue({});
      mockRequestRepo.save.mockResolvedValue({ ...request, status: RequestStatus.CANCELLED });

      const result = await service.cancel('uuid1');
      expect(result.status).toBe(RequestStatus.CANCELLED);
      expect(mockHcmService.restoreBalance).toHaveBeenCalled();
    });

    it('should throw if request cannot be cancelled', async () => {
      mockRequestRepo.findOne.mockResolvedValue({ status: RequestStatus.REJECTED });
      await expect(service.cancel('uuid1')).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if request not found', async () => {
      mockRequestRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});