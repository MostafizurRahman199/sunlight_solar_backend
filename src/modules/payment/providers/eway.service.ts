import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EwayConfig } from '../../../config/eway.config';
import {
  IEwayAccessCodeRequest,
  IEwayAccessCodeResponse,
  IEwayTransactionResult,
  IEwayRefundRequest,
  IEwayRefundResponse,
} from '../interfaces/eway.interface';
import { CreateAccessCodeDto } from '../dto/create-access-code.dto';
import { DirectPaymentDto } from '../dto/direct-payment.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto';

@Injectable()
export class EwayService {
  private readonly logger = new Logger(EwayService.name);
  private readonly ewayConfig: EwayConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.ewayConfig = this.configService.get<EwayConfig>('eway')!;
  }

  /**
   * Check if mock mode is active
   */
  public isMockMode(): boolean {
    return this.ewayConfig.mockMode;
  }

  /**
   * Public configuration safe to share with frontend
   */
  public getPublicConfig() {
    return {
      mode: this.ewayConfig.mode,
      mockMode: this.ewayConfig.mockMode,
      publicApiKey: this.ewayConfig.publicApiKey || 'mock-public-api-key',
    };
  }

  /**
   * Generate Basic Authorization Header for eWay Rapid API
   */
  private getAuthHeader(): { Authorization: string; 'Content-Type': string } {
    const credentials = `${this.ewayConfig.apiKey}:${this.ewayConfig.password}`;
    const base64Auth = Buffer.from(credentials).toString('base64');
    return {
      Authorization: `Basic ${base64Auth}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Initiate payment & request eWay Access Code (Responsive Shared Page flow)
   */
  async createAccessCode(dto: CreateAccessCodeDto): Promise<IEwayAccessCodeResponse> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://sunlitesolar.com.au';

    const rawRedirect = dto.redirectUrl || frontendUrl;
    const rawCancel = dto.cancelUrl || frontendUrl;

    // eWay strictly rejects hash fragments (#...) in RedirectUrl/CancelUrl
    const redirectUrl = rawRedirect.split('#')[0].replace(/\/$/, '');
    const cancelUrl = rawCancel.split('#')[0].replace(/\/$/, '');

    if (this.ewayConfig.mockMode) {
      this.logger.warn(
        'eWay credentials missing or mock mode enabled. Returning simulated eWay AccessCode.',
      );
      const mockAccessCode = `MOCK-EWAY-AC-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;

      return {
        AccessCode: mockAccessCode,
        FormUrl: `https://api.sandbox.ewaypayments.com/sharedpage/sharedpayment?AccessCode=${mockAccessCode}`,
        SharedPaymentUrl: `https://api.sandbox.ewaypayments.com/sharedpage/sharedpayment?AccessCode=${mockAccessCode}`,
        Errors: null,
        Customer: {
          FirstName: dto.customer.firstName,
          LastName: dto.customer.lastName,
          Email: dto.customer.email,
        },
        Payment: {
          TotalAmount: dto.amount,
          InvoiceNumber: dto.invoiceNumber || `INV-${Date.now()}`,
          InvoiceDescription:
            dto.invoiceDescription || 'Sunlite Solar Payment',
          CurrencyCode: dto.currencyCode || 'AUD',
        },
      };
    }

    const payload: IEwayAccessCodeRequest = {
      Customer: {
        FirstName: dto.customer.firstName,
        LastName: dto.customer.lastName,
        Email: dto.customer.email,
        Phone: dto.customer.phone,
        Street1: dto.customer.street,
        City: dto.customer.city,
        State: dto.customer.state,
        PostalCode: dto.customer.postalCode,
        Country: dto.customer.country || 'AU',
      },
      Payment: {
        TotalAmount: dto.amount,
        InvoiceNumber: dto.invoiceNumber || `INV-${Date.now()}`,
        InvoiceDescription:
          dto.invoiceDescription || 'Sunlite Solar Payment',
        CurrencyCode: dto.currencyCode || 'AUD',
      },
      CustomerIP: dto.clientIp || '1.1.1.1',
      RedirectUrl: redirectUrl,
      CancelUrl: cancelUrl,
      Method: 'ProcessPayment',
      TransactionType: 'Purchase',
    };

    const executeRequest = async (attempt = 1): Promise<IEwayAccessCodeResponse> => {
      try {
        const endpoint = `${this.ewayConfig.baseUrl}/AccessCodes`;

        const response = await firstValueFrom(
          this.httpService.post<IEwayAccessCodeResponse>(endpoint, payload, {
            headers: this.getAuthHeader(),
            timeout: 15000,
          }),
        );
        const data = response.data;
        this.logger.log(`📥 [EWAY ACCESS CODE RAW RESPONSE]: ${JSON.stringify(data)}`);

        const defaultSharedPageHost =
          this.ewayConfig.mode === 'production'
            ? 'https://secure.ewaypayments.com'
            : 'https://secure-au.sandbox.ewaypayments.com';

        const rawAccessCode = data.AccessCode;
        const sharedUrl =
          data.FormUrl ||
          data.SharedPaymentUrl ||
          (data as any).SharedPageUrl ||
          `${defaultSharedPageHost}/sharedpage/sharedpayment?AccessCode=${rawAccessCode}`;

        this.logger.log(`🔗 [EWAY FINAL SHARED FORM URL]: ${sharedUrl}`);

        return {
          ...data,
          FormUrl: sharedUrl,
          SharedPaymentUrl: sharedUrl,
        };
      } catch (error: any) {
        if (attempt === 1 && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
          this.logger.warn(`Network glitch (${error.code}). Retrying eWay API request...`);
          return executeRequest(2);
        }
        this.logger.error(
          'Failed to generate eWay AccessCode',
          error?.response?.data || error.message,
        );
        throw new BadRequestException(
          error?.response?.data?.Errors ||
            'Failed to communicate with eWay Payment Gateway.',
        );
      }
    };

    return executeRequest();
  }

  /**
   * Query transaction result using AccessCode after eWay redirect
   */
  async getAccessCodeResult(accessCode: string): Promise<IEwayTransactionResult> {
    if (this.ewayConfig.mockMode || accessCode.startsWith('MOCK-')) {
      this.logger.warn(`Returning mock transaction status for code ${accessCode}`);
      return {
        AccessCode: accessCode,
        AuthorisationCode: 'MOCK123456',
        ResponseCode: '00',
        ResponseMessage: 'A2000 - Transaction Approved (Mock)',
        InvoiceNumber: `INV-${Date.now()}`,
        InvoiceReference: 'SUNLITE-REF-MOCK',
        TotalAmount: 10000,
        TransactionID: Math.floor(1000000 + Math.random() * 9000000),
        TransactionStatus: true,
        TransactionType: 'Purchase',
        Errors: null,
      };
    }

    try {
      const endpoint = `${this.ewayConfig.baseUrl}/AccessCode/${encodeURIComponent(
        accessCode,
      )}`;
      const response = await firstValueFrom(
        this.httpService.get<IEwayTransactionResult>(endpoint, {
          headers: this.getAuthHeader(),
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch eWay transaction result for code ${accessCode}`,
        error?.response?.data || error.message,
      );
      throw new BadRequestException(
        error?.response?.data?.Errors ||
          'Failed to retrieve transaction result from eWay.',
      );
    }
  }

  /**
   * Direct Payment Processing via eWay API
   */
  async processDirectPayment(dto: DirectPaymentDto): Promise<IEwayTransactionResult> {
    if (this.ewayConfig.mockMode) {
      this.logger.warn('Processing mock direct payment');
      return {
        AccessCode: `MOCK-DIRECT-${Date.now()}`,
        AuthorisationCode: 'MOCK-DIRECT-AUTH',
        ResponseCode: '00',
        ResponseMessage: 'A2000 - Transaction Approved (Mock Direct)',
        InvoiceNumber: dto.invoiceNumber || `INV-${Date.now()}`,
        InvoiceReference: 'SUNLITE-DIRECT-REF',
        TotalAmount: dto.amount,
        TransactionID: Math.floor(1000000 + Math.random() * 9000000),
        TransactionStatus: true,
        TransactionType: 'Purchase',
        Customer: {
          FirstName: dto.customer.firstName,
          LastName: dto.customer.lastName,
          Email: dto.customer.email,
        },
      };
    }

    const payload = {
      Customer: {
        FirstName: dto.customer.firstName,
        LastName: dto.customer.lastName,
        Email: dto.customer.email,
        CardDetails: {
          Name: dto.cardDetails.name,
          Number: dto.cardDetails.number,
          ExpiryMonth: dto.cardDetails.expiryMonth?.padStart(2, '0') || '02',
          ExpiryYear: dto.cardDetails.expiryYear?.slice(-2) || '28',
          CVN: dto.cardDetails.cvn,
        },
      },
      Payment: {
        TotalAmount: dto.amount,
        InvoiceNumber: dto.invoiceNumber || `INV-${Date.now()}`,
        CurrencyCode: dto.currencyCode || 'AUD',
      },
      Method: 'ProcessPayment',
      TransactionType: 'Purchase',
    };

    try {
      const endpoint = `${this.ewayConfig.baseUrl}/Transaction`;
      const response = await firstValueFrom(
        this.httpService.post<IEwayTransactionResult>(endpoint, payload, {
          headers: this.getAuthHeader(),
          timeout: 15000,
        }),
      );
      const data = response.data;
      this.logger.log(`📥 [DIRECT PAYMENT API RAW RESPONSE]: ${JSON.stringify(data)}`);

      // Normalize fields if returned inside data.Payment or data root
      const totalAmount = data.TotalAmount ?? (data as any).Payment?.TotalAmount ?? dto.amount;
      const responseCode = data.ResponseCode ?? (data as any).Payment?.ResponseCode ?? 'N/A';
      const responseMessage = data.ResponseMessage ?? (data as any).Payment?.ResponseMessage ?? (data.Errors || 'Unknown Status');

      return {
        ...data,
        TotalAmount: totalAmount,
        ResponseCode: responseCode,
        ResponseMessage: responseMessage,
      };
    } catch (error: any) {
      this.logger.error(
        'Direct Payment process failed',
        error?.response?.data || error.message,
      );
      throw new BadRequestException(
        error?.response?.data?.Errors ||
          'Failed to process direct payment with eWay.',
      );
    }
  }

  /**
   * Refund an existing eWay Transaction
   */
  async refundPayment(dto: RefundPaymentDto): Promise<IEwayRefundResponse> {
    if (this.ewayConfig.mockMode || dto.transactionId.startsWith('MOCK')) {
      this.logger.warn(`Processing mock refund for transaction ${dto.transactionId}`);
      return {
        TransactionID: Math.floor(1000000 + Math.random() * 9000000),
        TransactionStatus: true,
        ResponseCode: '00',
        ResponseMessage: 'A2000 - Refund Successful (Mock)',
        Errors: null,
      };
    }

    const payload: IEwayRefundRequest = {
      Refund: {
        TransactionID: dto.transactionId,
        TotalAmount: dto.amount,
      },
    };

    try {
      const endpoint = `${this.ewayConfig.baseUrl}/Transaction/${dto.transactionId}/Refund`;
      const response = await firstValueFrom(
        this.httpService.post<IEwayRefundResponse>(endpoint, payload, {
          headers: this.getAuthHeader(),
        }),
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Refund failed for transaction ${dto.transactionId}`,
        error?.response?.data || error.message,
      );
      throw new BadRequestException(
        error?.response?.data?.Errors || 'Failed to refund transaction via eWay.',
      );
    }
  }
}
