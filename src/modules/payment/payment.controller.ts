import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreateAccessCodeDto } from './dto/create-access-code.dto';
import { DirectPaymentDto } from './dto/direct-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';

@Controller('payments/eway')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('config')
  getPublicConfig() {
    return this.paymentService.getPublicPaymentConfig();
  }

  /**
   * Initiate checkout (Works for BOTH guest users & logged-in users)
   */
  @Post('create-access-code')
  async createAccessCode(@Body() dto: CreateAccessCodeDto, @Req() req: any) {
    const userId = req.user?.id; // Optional if bearer token passed
    return await this.paymentService.createPaymentSession(dto, userId);
  }

  @Get('complete/:accessCode')
  async completePayment(@Param('accessCode') accessCode: string) {
    return await this.paymentService.verifyAndCompletePayment(accessCode);
  }

  /**
   * Process direct card payment (Works for BOTH guest users & logged-in users)
   */
  @Post('direct')
  async processDirectPayment(@Body() dto: DirectPaymentDto, @Req() req: any) {
    const userId = req.user?.id; // Optional if bearer token passed
    return await this.paymentService.processDirectCardPayment(dto, userId);
  }

  /**
   * Get payment history for the currently logged-in user
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('my-history')
  async getMyPaymentHistory(@Req() req: any) {
    return await this.paymentService.getUserPayments(req.user.id);
  }

  /**
   * Admin-only: Get all payments and transaction summary
   */
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('admin/all')
  async getAllPaymentsForAdmin() {
    return await this.paymentService.getAllPaymentsAdmin();
  }

  /**
   * Refund payment
   */
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('refund')
  async refundPayment(@Body() dto: RefundPaymentDto) {
    return await this.paymentService.refund(dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    return await this.paymentService.handleWebhook(payload);
  }
}
