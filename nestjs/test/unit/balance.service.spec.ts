import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from '../../src/balance/balance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaveBalance } from '../../src/balance/entities/leave-balance.entity';
import { SyncLog } from '../../src/sync/entities/sync-log.entity';
import { HcmService } from '../../src/hcm/hcm.service';

const mockBalanceRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockSyncLogRepo = {
  save: jest.fn(),
};

const mockHcmService = {
  getBalance: jest.fn(),
};

describe('BalanceService', () => {
  let service: BalanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: getRepositoryToken(LeaveBalance), useValue: mockBalanceRepo },
        { provide: getRepositoryToken(SyncLog), useValue: mockSyncLogRepo },
        { provide: HcmService, useValue: mockHcmService },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalancesByEmployee', () => {
    it('should return balances for an employee', async () => {
      const balances = [{ employeeId: 'E001', locationId: 'LOC_KHI', totalDays: 10 }];
      mockBalanceRepo.find.mockResolvedValue(balances);
      const result = await service.getBalancesByEmployee('E001');
      expect(result).toEqual(balances);
      expect(mockBalanceRepo.find).toHaveBeenCalledWith({ where: { employeeId: 'E001' } });
    });

    it('should return empty array if no balances found', async () => {
      mockBalanceRepo.find.mockResolvedValue([]);
      const result = await service.getBalancesByEmployee('UNKNOWN');
      expect(result).toEqual([]);
    });
  });

  describe('getBalance', () => {
    it('should return a single balance', async () => {
      const balance = { employeeId: 'E001', locationId: 'LOC_KHI', totalDays: 10 };
      mockBalanceRepo.findOne.mockResolvedValue(balance);
      const result = await service.getBalance('E001', 'LOC_KHI');
      expect(result).toEqual(balance);
    });

    it('should return null if balance not found', async () => {
      mockBalanceRepo.findOne.mockResolvedValue(null);
      const result = await service.getBalance('E999', 'LOC_KHI');
      expect(result).toBeNull();
    });
  });

  describe('syncBatch', () => {
    it('should create new balance if not exists', async () => {
      mockBalanceRepo.findOne.mockResolvedValue(null);
      mockBalanceRepo.create.mockReturnValue({ employeeId: 'E001', locationId: 'LOC_KHI', totalDays: 10 });
      mockBalanceRepo.save.mockResolvedValue({});
      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.syncBatch({
        records: [{ employeeId: 'E001', locationId: 'LOC_KHI', totalDays: 10 }],
      });

      expect(result.processed).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.unchanged).toBe(0);
    });

    it('should mark as unchanged if totalDays match', async () => {
      mockBalanceRepo.findOne.mockResolvedValue({ totalDays: 10 });
      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.syncBatch({
        records: [{ employeeId: 'E001', locationId: 'LOC_KHI', totalDays: 10 }],
      });

      expect(result.unchanged).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('should update balance if totalDays differ', async () => {
      mockBalanceRepo.findOne.mockResolvedValue({ totalDays: 10 });
      mockBalanceRepo.save.mockResolvedValue({});
      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.syncBatch({
        records: [{ employeeId: 'E001', locationId: 'LOC_KHI', totalDays: 15 }],
      });

      expect(result.updated).toBe(1);
    });
  });

  describe('syncRealtime', () => {
    it('should pull balance from HCM and save locally', async () => {
      mockHcmService.getBalance.mockResolvedValue(12);
      mockBalanceRepo.findOne.mockResolvedValue(null);
      mockBalanceRepo.create.mockReturnValue({ employeeId: 'E001', locationId: 'LOC_KHI', totalDays: 12 });
      mockBalanceRepo.save.mockResolvedValue({ employeeId: 'E001', totalDays: 12 });
      mockSyncLogRepo.save.mockResolvedValue({});

      const result = await service.syncRealtime('E001', 'LOC_KHI');
      expect(mockHcmService.getBalance).toHaveBeenCalledWith('E001', 'LOC_KHI');
      expect(mockBalanceRepo.save).toHaveBeenCalled();
    });
  });
});