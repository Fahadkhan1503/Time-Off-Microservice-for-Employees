import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncRecordDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  totalDays: number;
}

export class SyncBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncRecordDto)
  records: SyncRecordDto[];
}