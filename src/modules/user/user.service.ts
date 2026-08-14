import {
  Injectable,
  Logger,
  OnModuleInit,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/auth.dto';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * On application startup: automatically seed default Admin user from .env
   */
  async onModuleInit() {
    await this.seedAdminUser();
  }

  private async seedAdminUser() {
    const adminEmail =
      this.configService.get<string>('ADMIN_EMAIL') || 'admin@sunlitesolar.com.au';
    const adminPassword =
      this.configService.get<string>('ADMIN_PASSWORD') || 'AdminSunlite2026!';

    try {
      const existingAdmin = await this.userRepository.findOne({
        where: { email: adminEmail.toLowerCase() },
      });

      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const admin = this.userRepository.create({
          email: adminEmail.toLowerCase(),
          password: hashedPassword,
          firstName: 'System',
          lastName: 'Admin',
          role: UserRole.ADMIN,
        });

        await this.userRepository.save(admin);
        this.logger.log(
          `👑 [ADMIN SEEDED] Default Admin user created successfully: ${adminEmail}`,
        );
      } else {
        this.logger.log(`👑 [ADMIN CHECK] Admin account verified: ${adminEmail}`);
      }
    } catch (err: any) {
      this.logger.error('Failed to seed admin user:', err?.message || err);
    }
  }

  async createUser(dto: RegisterDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: UserRole.CUSTOMER,
    });

    return await this.userRepository.save(user);
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  async findAllUsers(): Promise<User[]> {
    return await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
  }
}
