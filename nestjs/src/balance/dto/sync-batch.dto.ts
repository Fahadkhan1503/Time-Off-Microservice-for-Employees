import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncRecordDto {
  employeeId: string;
  locationId: string;
  totalDays: number;
}

export class SyncBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncRecordDto)
  records: SyncRecordDto[];
}