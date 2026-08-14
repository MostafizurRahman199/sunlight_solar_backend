import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { EwayService } from './providers/eway.service';
import { Payment } from './entities/payment.entity';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([Payment]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, EwayService],
  exports: [PaymentService, EwayService],
})
export class PaymentModule {}
