import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  REFUNDED = 'REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  transactionId?: string;

  @Column({ nullable: true })
  accessCode?: string;

  @Column({ type: 'int' })
  amount: number; // In cents (e.g. 15000 = $150.00 AUD)

  @Column({ default: 'AUD' })
  currency: string;

  @Column({ type: 'varchar', default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column()
  invoiceNumber: string;

  @Column({ nullable: true })
  invoiceDescription?: string;

  @Column({ nullable: true })
  customerFirstName?: string;

  @Column({ nullable: true })
  customerLastName?: string;

  @Column()
  customerEmail: string;

  @Column({ nullable: true })
  customerPhone?: string;

  @Column({ nullable: true })
  customerStreet?: string;

  @Column({ nullable: true })
  customerSuburb?: string;

  @Column({ nullable: true })
  customerState?: string;

  @Column({ nullable: true })
  customerPostcode?: string;

  @Column({ default: 'eway_shared' })
  paymentMethod: string;

  @Column({ nullable: true })
  userId?: string;

  @ManyToOne(() => User, (user) => user.payments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
