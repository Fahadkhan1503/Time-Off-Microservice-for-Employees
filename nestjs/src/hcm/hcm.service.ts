import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class HcmService {
  private readonly logger = new Logger(HcmService.name);
  private readonly baseUrl = process.env.HCM_URL || 'http://localhost:3001';

  async getBalance(employeeId: string, locationId: string): Promise<number> {
    try {
      const res = await axios.get(`${this.baseUrl}/hcm/balance/${employeeId}/${locationId}`);
      return res.data.totalDays;
    } catch (error: any) {
      this.logger.error(`HCM getBalance failed: ${error.message}`);
      throw new Error('HCM_UNAVAILABLE');
    }
  }

  async deductBalance(employeeId: string, locationId: string, days: number): Promise<boolean> {
    try {
      const res = await axios.post(`${this.baseUrl}/hcm/balance/deduct`, {
        employeeId,
        locationId,
        days,
      });
      return res.data.success;
    } catch (error: any) {
      this.logger.error(`HCM deductBalance failed: ${error.message}`);
      throw new Error('HCM_DEDUCT_FAILED');
    }
  }

  async restoreBalance(employeeId: string, locationId: string, days: number): Promise<boolean> {
    try {
      const res = await axios.post(`${this.baseUrl}/hcm/balance/restore`, {
        employeeId,
        locationId,
        days,
      });
      return res.data.success;
    } catch (error: any) {
      this.logger.error(`HCM restoreBalance failed: ${error.message}`);
      throw new Error('HCM_RESTORE_FAILED');
    }
  }
}