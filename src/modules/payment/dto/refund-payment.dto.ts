import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RefundPaymentDto {
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @IsNumber()
  @Min(1)
  amount: number; // In cents

  @IsString()
  @IsOptional()
  reason?: string;
}
