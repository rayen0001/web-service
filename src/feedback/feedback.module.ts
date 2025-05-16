import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedbackService } from './feedback.service';
import { FeedbackResolver } from './feedback.resolver';
import { FeedbackSchema } from './feedback.schema/feedback.schema';


@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Feedback', schema: FeedbackSchema }]),
    
  ],
  providers: [FeedbackResolver, FeedbackService],
})
export class FeedbackModule {}




