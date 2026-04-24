import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { RequestStatus } from '../../common/enums/request-status.enum';

@Entity()
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @Column('decimal', { precision: 8, scale: 2 })
  days: number;

  @Column({ nullable: true })
  reason: string;

  @Column({ default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ nullable: true })
  managerId: string;

  @Column({ default: false })
  hcmSynced: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}