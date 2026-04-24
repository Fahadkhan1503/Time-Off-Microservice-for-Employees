import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { SyncType, SyncStatus } from '../../common/enums/sync-type.enum';

@Entity()
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  syncType: SyncType;

  @Column()
  status: SyncStatus;

  @Column({ default: 0 })
  recordsProcessed: number;

  @Column({ type: 'text', nullable: true })
  errorDetails: string;

  @CreateDateColumn()
  createdAt: Date;
}