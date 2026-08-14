import {
  IsCreditCard,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CustomerDto } from './create-access-code.dto';

export class CardDetailsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  expiryMonth: string;

  @IsString()
  @IsNotEmpty()
  expiryYear: string;

  @IsString()
  @IsNotEmpty()
  cvn: string;
}

export class DirectPaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  currencyCode?: string = 'AUD';

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsNotEmpty()
  customer: CustomerDto;

  @IsNotEmpty()
  cardDetails: CardDetailsDto;
}
