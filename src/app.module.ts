import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import ewayConfig from './config/eway.config';
import { PaymentModule } from './modules/payment/payment.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { User } from './modules/user/entities/user.entity';
import { Payment } from './modules/payment/entities/payment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [ewayConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        ssl: {
          rejectUnauthorized: false,
        },
        entities: [User, Payment],
        synchronize: true, // Automatically syncs schema with Supabase Postgres
      }),
    }),
    UserModule,
    AuthModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
