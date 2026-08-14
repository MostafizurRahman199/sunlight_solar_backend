import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { EwayService } from './providers/eway.service';
import { Payment } from './entities/payment.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([Payment, User]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, EwayService],
  exports: [PaymentService, EwayService],
})
export class PaymentModule {}
