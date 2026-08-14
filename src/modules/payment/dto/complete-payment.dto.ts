import { IsNotEmpty, IsString } from 'class-validator';

export class CompletePaymentDto {
  @IsString()
  @IsNotEmpty()
  accessCode: string;
}
