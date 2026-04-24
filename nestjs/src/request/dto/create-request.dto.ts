export class CreateRequestDto {
  employeeId: string;
  locationId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}