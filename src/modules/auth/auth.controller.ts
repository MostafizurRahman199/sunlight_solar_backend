import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from './admin.guard';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Req() req: any) {
    const { password, ...userWithoutPassword } = req.user;
    return userWithoutPassword;
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('users')
  async getAllUsers() {
    return await this.userService.findAllUsers();
  }
}
