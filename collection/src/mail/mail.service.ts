import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('email.host'),
      port: this.configService.get<number>('email.port'),
      secure: this.configService.get<boolean>('email.secure'),
      auth: {
        user: this.configService.get<string>('email.user'),
        pass: this.configService.get<string>('email.password'),
      },
    });
  }

  async sendRejectionEmail(
    to: string,
    name: string,
    service: string,
    reason: string,
  ): Promise<void> {
    try {
      const templatePath = path.join(
        __dirname,
        'templates',
        'rejection.hbs',
      );
      const templateSource = fs.readFileSync(templatePath, 'utf-8');

      const template = handlebars.compile(templateSource);
      const htmlContent = template({
        name,
        service,
        reason,
      });

      const mailOptions = {
        from: this.configService.get<string>('email.from'),
        to,
        subject: 'Feedback Rejection',
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  }
}