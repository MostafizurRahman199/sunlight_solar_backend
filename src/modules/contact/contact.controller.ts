import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { ContactStatus } from './entities/contact.entity';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /**
   * Public: Submit contact form message
   */
  @Post()
  async createMessage(@Body() dto: CreateContactDto) {
    return await this.contactService.create(dto);
  }

  /**
   * Admin-only: Get all submitted contact messages
   */
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('admin/all')
  async getAllMessagesForAdmin() {
    return await this.contactService.findAllForAdmin();
  }

  /**
   * Admin-only: Update message status (e.g. READ, UNREAD, REPLIED)
   */
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Patch('admin/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ContactStatus,
  ) {
    return await this.contactService.updateStatus(id, status);
  }

  /**
   * Admin-only: Delete message
   */
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Delete('admin/:id')
  async deleteMessage(@Param('id') id: string) {
    return await this.contactService.deleteMessage(id);
  }
}
