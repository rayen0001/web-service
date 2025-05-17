import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedbackService } from './feedback.service';
import { FeedbackResolver } from './feedback.resolver';
import { FeedbackSchema } from './feedback.schema/feedback.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Feedback', schema: FeedbackSchema }]),
    MailModule,
  ],
  providers: [FeedbackResolver, FeedbackService],
})
export class FeedbackModule {}




