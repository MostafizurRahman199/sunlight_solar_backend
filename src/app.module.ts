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
      useFactory: (configService: ConfigService) => {
        const dbUrl =
          configService.get<string>('DATABASE_URL') ||
          process.env.DATABASE_URL ||
          'postgresql://postgres.krjovvdzugktarttxthg:iloveWorld2026@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

        return {
          type: 'postgres',
          url: dbUrl,
          ssl: {
            rejectUnauthorized: false,
          },
          entities: [User, Payment],
          synchronize: true, // Automatically syncs schema with Supabase Postgres
          connectTimeoutMS: 10000,
          extra: {
            max: 10,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
          },
        };
      },
    }),
    UserModule,
    AuthModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
