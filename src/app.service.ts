import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      status: 'ok',
      message: 'Sunlite Solar Backend API is running',
      timestamp: new Date().toISOString(),
    };
  }
}
