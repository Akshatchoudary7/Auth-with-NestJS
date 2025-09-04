import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailerService {
  constructor(private configService: ConfigService) {}

  async sendMail(to: string, subject: string, html: string) {
    console.log('\n=== Simulated Email ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML: ${html}`);
    console.log('======================\n');
  }
}
