import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeedbackDocument } from './feedback.schema/feedback.schema';
import { CreateFeedbackInput } from './dto/feedback.dto/feedback.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectModel('Feedback') private feedbackModel: Model<FeedbackDocument>,
  ) {}

  async create(createFeedbackInput: CreateFeedbackInput): Promise<FeedbackDocument> {
    try {
      const createdFeedback = new this.feedbackModel(createFeedbackInput);
      return createdFeedback.save();
    } catch (error) {
      this.logger.error(`Error processing feedback: ${error.message}`);
      throw new Error(`Error while processing feedback: ${error.message}`);
    }
  }
}
