import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { tmpdir } from 'os';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.NODE_ENV === 'test' ? join(tmpdir(), 'test-timeoff.db') : join(process.cwd(), 'data', 'timeoff.db'),
      entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
      synchronize: true,
      logging: false,
    }),
  ],
})
export class DatabaseModule {}