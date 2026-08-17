import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EwayService } from './providers/eway.service';
import { CreateAccessCodeDto } from './dto/create-access-code.dto';
import { DirectPaymentDto } from './dto/direct-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly ewayService: EwayService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get public configuration details for frontend integration
   */
  getPublicPaymentConfig() {
    this.logger.log('📢 Frontend requested eWay Gateway Configuration');
    return {
      provider: 'eway',
      gatewayName: 'eWay Payment Gateway Australia',
      ...this.ewayService.getPublicConfig(),
    };
  }

  /**
   * Helper to resolve userId by explicit ID or customer email
   */
  private async resolveUserId(explicitUserId?: string, email?: string): Promise<string | undefined> {
    if (explicitUserId) return explicitUserId;
    if (email) {
      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) return existingUser.id;
    }
    return undefined;
  }

  /**
   * Initialize checkout session / generate eWay Access Code and save initial PENDING payment in DB
   */
  async createPaymentSession(dto: CreateAccessCodeDto, userId?: string) {
    const targetUserId = await this.resolveUserId(userId, dto.customer?.email);

    const formattedAmount = (dto.amount / 100).toFixed(2);
    this.logger.log(
      `💳 [PAYMENT INITIATED] Customer: ${dto.customer.firstName} ${dto.customer.lastName} (${dto.customer.email}) | Amount: $${formattedAmount} ${dto.currencyCode || 'AUD'} | Invoice: ${dto.invoiceNumber || 'Auto-Generated'} | UserID: ${targetUserId || 'Guest'}`,
    );

    const session = await this.ewayService.createAccessCode(dto);

    // Save pending payment in Supabase Postgres
    const payment = this.paymentRepository.create({
      accessCode: session.AccessCode,
      amount: dto.amount,
      currency: dto.currencyCode || 'AUD',
      status: PaymentStatus.PENDING,
      invoiceNumber: dto.invoiceNumber || session.Payment?.InvoiceNumber || `INV-${Date.now()}`,
      invoiceDescription: dto.invoiceDescription || 'Sunlite Solar Payment',
      customerFirstName: dto.customer.firstName,
      customerLastName: dto.customer.lastName,
      customerEmail: dto.customer.email,
      customerPhone: dto.customer.phone,
      customerStreet: dto.customer.street,
      customerSuburb: dto.customer.city,
      customerState: dto.customer.state,
      customerPostcode: dto.customer.postalCode,
      paymentMethod: 'eway_shared',
      userId: targetUserId || undefined,
    });

    await this.paymentRepository.save(payment);

    this.logger.log(
      `🔑 [ACCESS CODE GENERATED & SAVED TO DB] AccessCode: ${session.AccessCode} | Form URL: ${session.FormUrl || 'N/A'}`,
    );
    return session;
  }

  /**
   * Verify and complete payment after customer checkout redirect
   */
  async verifyAndCompletePayment(accessCode: string) {
    this.logger.log(`🔍 [VERIFYING TRANSACTION] Querying eWay for AccessCode: ${accessCode}`);
    const result = await this.ewayService.getAccessCodeResult(accessCode);
    const formattedAmount = (result.TotalAmount / 100).toFixed(2);

    const isApproved = result.TransactionStatus === true;
    const newStatus = isApproved ? PaymentStatus.APPROVED : PaymentStatus.DECLINED;

    // Find and update existing pending payment, or create one if not found
    let payment = await this.paymentRepository.findOne({
      where: { accessCode },
    });

    if (payment) {
      payment.status = newStatus;
      payment.transactionId = result.TransactionID?.toString() || payment.transactionId;
      payment.rawResponse = result;
      
      // Auto-link userId if missing but customer email matches a user
      if (!payment.userId && payment.customerEmail) {
        const matchedUser = await this.userRepository.findOne({ where: { email: payment.customerEmail } });
        if (matchedUser) payment.userId = matchedUser.id;
      }
      
      await this.paymentRepository.save(payment);
    } else {
      const customerEmail = result.Customer?.Email || 'guest@sunlitesolar.com.au';
      const matchedUser = await this.userRepository.findOne({ where: { email: customerEmail } });

      payment = this.paymentRepository.create({
        accessCode,
        transactionId: result.TransactionID?.toString(),
        amount: result.TotalAmount || 0,
        currency: 'AUD',
        status: newStatus,
        invoiceNumber: result.InvoiceNumber || `INV-${Date.now()}`,
        customerEmail,
        customerFirstName: result.Customer?.FirstName || 'Customer',
        customerLastName: result.Customer?.LastName || '',
        paymentMethod: 'eway_shared',
        userId: matchedUser?.id,
        rawResponse: result,
      });
      await this.paymentRepository.save(payment);
    }

    if (isApproved) {
      this.logger.log(
        `✅ [PAYMENT APPROVED & SAVED] TxID: #${result.TransactionID} | Amount: $${formattedAmount} AUD | Invoice: ${payment.invoiceNumber}`,
      );
    } else {
      this.logger.error(
        `❌ [PAYMENT DECLINED] AccessCode: ${accessCode} | Response: ${result.ResponseCode} - ${result.ResponseMessage}`,
      );
    }

    return {
      success: isApproved,
      transactionId: result.TransactionID,
      responseCode: result.ResponseCode,
      responseMessage: result.ResponseMessage,
      invoiceNumber: payment.invoiceNumber,
      amount: result.TotalAmount,
      raw: result,
    };
  }

  /**
   * Process Direct Card Payment & save to DB
   */
  async processDirectCardPayment(dto: DirectPaymentDto, userId?: string) {
    const targetUserId = await this.resolveUserId(userId, dto.customer?.email);

    const formattedAmount = (dto.amount / 100).toFixed(2);
    this.logger.log(
      `💳 [DIRECT CARD PAYMENT SUBMITTED] Customer: ${dto.customer.email} | Amount: $${formattedAmount} AUD | UserID: ${targetUserId || 'Guest'}`,
    );

    const result = await this.ewayService.processDirectPayment(dto);
    const isApproved = result.TransactionStatus === true;
    const newStatus = isApproved ? PaymentStatus.APPROVED : PaymentStatus.DECLINED;

    // Save to Supabase Postgres
    const payment = this.paymentRepository.create({
      transactionId: result.TransactionID?.toString(),
      accessCode: result.AccessCode,
      amount: dto.amount,
      currency: dto.currencyCode || 'AUD',
      status: newStatus,
      invoiceNumber: dto.invoiceNumber || result.InvoiceNumber || `INV-${Date.now()}`,
      invoiceDescription: 'Sunlite Solar Payment',
      customerFirstName: dto.customer.firstName,
      customerLastName: dto.customer.lastName,
      customerEmail: dto.customer.email,
      customerPhone: dto.customer.phone,
      customerStreet: dto.customer.street,
      customerSuburb: dto.customer.city,
      customerState: dto.customer.state,
      customerPostcode: dto.customer.postalCode,
      paymentMethod: 'eway_direct',
      userId: targetUserId || undefined,
      rawResponse: result,
    });

    await this.paymentRepository.save(payment);

    if (isApproved) {
      this.logger.log(
        `✅ [DIRECT PAYMENT APPROVED & SAVED] TxID: #${result.TransactionID} | Amount: $${formattedAmount} AUD`,
      );
      return {
        success: true,
        transactionId: result.TransactionID,
        responseCode: result.ResponseCode || '00',
        responseMessage: result.ResponseMessage || 'Approved',
        invoiceNumber: payment.invoiceNumber,
        amount: result.TotalAmount ?? dto.amount,
        raw: result,
      };
    } else {
      const errorDetails = result.Errors || result.ResponseMessage || 'Payment declined by bank/gateway.';
      this.logger.error(
        `❌ [DIRECT PAYMENT DECLINED] Response: ${result.ResponseCode || 'N/A'} - ${errorDetails}`,
      );
      throw new BadRequestException(
        `eWay Payment Declined (${errorDetails}). Please check card details or use Hosted Payment Page.`,
      );
    }
  }

  /**
   * Process refund request and update status in DB
   */
  async refund(dto: RefundPaymentDto) {
    const formattedAmount = (dto.amount / 100).toFixed(2);
    this.logger.log(
      `🔄 [REFUND REQUESTED] Transaction ID: #${dto.transactionId} | Refund Amount: $${formattedAmount} AUD`,
    );

    const result = await this.ewayService.refundPayment(dto);

    if (result.TransactionStatus) {
      // Find payment record by transactionId and mark as REFUNDED
      const payment = await this.paymentRepository.findOne({
        where: { transactionId: dto.transactionId },
      });
      if (payment) {
        payment.status = PaymentStatus.REFUNDED;
        await this.paymentRepository.save(payment);
      }

      this.logger.log(
        `✅ [REFUND APPROVED & UPDATED IN DB] Transaction ID: #${dto.transactionId}`,
      );
    } else {
      this.logger.error(
        `❌ [REFUND FAILED] Transaction ID: #${dto.transactionId}`,
      );
    }

    return result;
  }

  /**
   * Fetch payment history for a logged in user (by userId or customerEmail)
   */
  async getUserPayments(userId: string, email?: string): Promise<Payment[]> {
    const whereConditions: any[] = [{ userId }];
    if (email) {
      whereConditions.push({ customerEmail: email });
    }

    return await this.paymentRepository.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Admin: Fetch all payments (Guest & Customer) with summary statistics
   */
  async getAllPaymentsAdmin() {
    const payments = await this.paymentRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    const approvedPayments = payments.filter((p) => p.status === PaymentStatus.APPROVED);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let totalRevenueCents = 0;
    let dailyRevenueCents = 0;
    let weeklyRevenueCents = 0;
    let monthlyRevenueCents = 0;
    let yearlyRevenueCents = 0;

    approvedPayments.forEach((p) => {
      const pDate = new Date(p.createdAt);
      const amount = p.amount || 0;

      totalRevenueCents += amount;

      if (pDate >= startOfToday) {
        dailyRevenueCents += amount;
      }
      if (pDate >= sevenDaysAgo) {
        weeklyRevenueCents += amount;
      }
      if (pDate >= startOfMonth) {
        monthlyRevenueCents += amount;
      }
      if (pDate >= startOfYear) {
        yearlyRevenueCents += amount;
      }
    });

    return {
      stats: {
        totalTransactions: payments.length,
        totalApprovedCount: approvedPayments.length,
        totalRevenueAud: (totalRevenueCents / 100).toFixed(2),
        dailyRevenueAud: (dailyRevenueCents / 100).toFixed(2),
        weeklyRevenueAud: (weeklyRevenueCents / 100).toFixed(2),
        monthlyRevenueAud: (monthlyRevenueCents / 100).toFixed(2),
        yearlyRevenueAud: (yearlyRevenueCents / 100).toFixed(2),
      },
      payments,
    };
  }

  /**
   * Handle eWay webhook notification
   */
  async handleWebhook(payload: any) {
    this.logger.log('🔔 [WEBHOOK NOTIFICATION RECEIVED] eWay Event:', JSON.stringify(payload));
    return { status: 'acknowledged', receivedAt: new Date().toISOString() };
  }
}
