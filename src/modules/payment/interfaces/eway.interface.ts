export interface IEwayCustomer {
  TokenCustomerID?: string;
  Reference?: string;
  Title?: string;
  FirstName: string;
  LastName: string;
  CompanyName?: string;
  JobTitle?: string;
  Street1?: string;
  Street2?: string;
  City?: string;
  State?: string;
  PostalCode?: string;
  Country?: string;
  Email: string;
  Phone?: string;
  Mobile?: string;
  Comments?: string;
  Fax?: string;
  Url?: string;
  CardDetails?: {
    Name?: string;
    Number?: string;
    ExpiryMonth?: string;
    ExpiryYear?: string;
    CVN?: string;
  };
}

export interface IEwayPaymentDetails {
  TotalAmount: number; // In cents or lowest unit, e.g. $10.50 AUD = 1050
  InvoiceNumber?: string;
  InvoiceDescription?: string;
  InvoiceReference?: string;
  CurrencyCode?: string; // Default 'AUD'
}

export interface IEwayAccessCodeRequest {
  Customer: IEwayCustomer;
  Payment: IEwayPaymentDetails;
  RedirectUrl: string;
  CancelUrl: string;
  Method: 'ProcessPayment' | 'CreateTokenCustomer' | 'UpdateTokenCustomer' | 'TokenPayment';
  TransactionType: 'Purchase' | 'MOTO' | 'Recurring';
  DeviceID?: string;
  CustomerIP?: string;
  PartnerID?: string;
}

export interface IEwayAccessCodeResponse {
  AccessCode: string;
  FormUrl?: string;
  SharedPaymentUrl?: string;
  Errors?: string | null;
  Customer?: IEwayCustomer;
  Payment?: IEwayPaymentDetails;
}

export interface IEwayTransactionResult {
  AccessCode: string;
  AuthorisationCode: string;
  ResponseCode: string;
  ResponseMessage: string;
  InvoiceNumber: string;
  InvoiceReference: string;
  TotalAmount: number;
  TransactionID: number;
  TransactionStatus: boolean;
  TransactionType: string;
  Errors?: string | null;
  Customer?: IEwayCustomer;
}

export interface IEwayRefundRequest {
  Refund: {
    TransactionID: string;
    TotalAmount: number;
    InvoiceNumber?: string;
    InvoiceDescription?: string;
  };
  Customer?: Partial<IEwayCustomer>;
}

export interface IEwayRefundResponse {
  TransactionID: number;
  TransactionStatus: boolean;
  ResponseCode: string;
  ResponseMessage: string;
  Errors?: string | null;
}
