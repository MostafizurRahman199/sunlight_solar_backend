import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact, ContactStatus } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
  ) {}

  async create(dto: CreateContactDto): Promise<Contact> {
    const contact = this.contactRepository.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone ? dto.phone.trim() : '',
      message: dto.message.trim(),
      status: ContactStatus.UNREAD,
    });
    return await this.contactRepository.save(contact);
  }

  async findAllForAdmin(): Promise<{ messages: Contact[]; unreadCount: number }> {
    const messages = await this.contactRepository.find({
      order: { createdAt: 'DESC' },
    });
    const unreadCount = messages.filter((m) => m.status === ContactStatus.UNREAD).length;
    return { messages, unreadCount };
  }

  async updateStatus(id: string, status: ContactStatus): Promise<Contact> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) {
      throw new NotFoundException('Contact message not found');
    }
    contact.status = status;
    return await this.contactRepository.save(contact);
  }

  async deleteMessage(id: string): Promise<{ message: string }> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) {
      throw new NotFoundException('Contact message not found');
    }
    await this.contactRepository.remove(contact);
    return { message: 'Message deleted successfully' };
  }
}
