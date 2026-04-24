import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(process.cwd(), 'data', 'timeoff.db'),
      entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
      synchronize: true,
      logging: false,
    }),
  ],
})
export class DatabaseModule {}