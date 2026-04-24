import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity()
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column('decimal', { precision: 8, scale: 2, default: 0 })
  totalDays: number;

  @Column('decimal', { precision: 8, scale: 2, default: 0 })
  usedDays: number;

  @Column('decimal', { precision: 8, scale: 2, default: 0 })
  pendingDays: number;

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get availableDays(): number {
    return Number(this.totalDays) - Number(this.usedDays) - Number(this.pendingDays);
  }
}