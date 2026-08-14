import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserRole } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.userService.createUser(dto);
    const token = this.generateToken(user.id, user.email, user.role);

    const { password, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmailWithPassword(dto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email address or password.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email address or password.');
    }

    const token = this.generateToken(user.id, user.email, user.role);
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken: token,
    };
  }

  private generateToken(userId: string, email: string, role: UserRole): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}
