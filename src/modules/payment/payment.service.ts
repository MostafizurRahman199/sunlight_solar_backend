import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EwayService } from './providers/eway.service';
import { CreateAccessCodeDto } from './dto/create-access-code.dto';
import { DirectPaymentDto } from './dto/direct-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { Payment, PaymentStatus } from './entities/payment.entity';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly ewayService: EwayService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
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
   * Initialize checkout session / generate eWay Access Code and save initial PENDING payment in DB
   */
  async createPaymentSession(dto: CreateAccessCodeDto, userId?: string) {
    const formattedAmount = (dto.amount / 100).toFixed(2);
    this.logger.log(
      `💳 [PAYMENT INITIATED] Customer: ${dto.customer.firstName} ${dto.customer.lastName} (${dto.customer.email}) | Amount: $${formattedAmount} ${dto.currencyCode || 'AUD'} | Invoice: ${dto.invoiceNumber || 'Auto-Generated'} | UserID: ${userId || 'Guest'}`,
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
      userId: userId || undefined,
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
      await this.paymentRepository.save(payment);
    } else {
      payment = this.paymentRepository.create({
        accessCode,
        transactionId: result.TransactionID?.toString(),
        amount: result.TotalAmount || 0,
        currency: 'AUD',
        status: newStatus,
        invoiceNumber: result.InvoiceNumber || `INV-${Date.now()}`,
        customerEmail: result.Customer?.Email || 'guest@sunlitesolar.com.au',
        customerFirstName: result.Customer?.FirstName || 'Customer',
        customerLastName: result.Customer?.LastName || '',
        paymentMethod: 'eway_shared',
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
    const formattedAmount = (dto.amount / 100).toFixed(2);
    this.logger.log(
      `💳 [DIRECT CARD PAYMENT SUBMITTED] Customer: ${dto.customer.email} | Amount: $${formattedAmount} AUD | UserID: ${userId || 'Guest'}`,
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
      userId: userId || undefined,
      rawResponse: result,
    });

    await this.paymentRepository.save(payment);

    if (isApproved) {
      this.logger.log(
        `✅ [DIRECT PAYMENT APPROVED & SAVED] TxID: #${result.TransactionID} | Amount: $${formattedAmount} AUD`,
      );
    } else {
      this.logger.error(
        `❌ [DIRECT PAYMENT DECLINED] Response: ${result.ResponseCode} - ${result.ResponseMessage}`,
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
   * Fetch payment history for a logged in user
   */
  async getUserPayments(userId: string): Promise<Payment[]> {
    return await this.paymentRepository.find({
      where: { userId },
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

    const totalApproved = payments.filter((p) => p.status === PaymentStatus.APPROVED);
    const totalRevenueCents = totalApproved.reduce((sum, p) => sum + p.amount, 0);

    return {
      stats: {
        totalTransactions: payments.length,
        totalApprovedCount: totalApproved.length,
        totalRevenueAud: (totalRevenueCents / 100).toFixed(2),
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
