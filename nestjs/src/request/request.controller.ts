import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';

@Controller('api/v1/requests')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  create(@Body() dto: CreateRequestDto) {
    return this.requestService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requestService.findOne(id);
  }

  @Get()
  findAll(@Query('employeeId') employeeId?: string, @Query('status') status?: string) {
    return this.requestService.findAll(employeeId, status);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveRequestDto) {
    return this.requestService.approve(id, dto);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() dto: ApproveRequestDto) {
    return this.requestService.reject(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.requestService.cancel(id);
  }
}