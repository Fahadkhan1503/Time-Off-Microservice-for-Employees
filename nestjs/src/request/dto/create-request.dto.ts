import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}