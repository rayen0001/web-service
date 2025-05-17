import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeedbackDocument } from './feedback.schema/feedback.schema';
import { CreateFeedbackInput } from './dto/feedback.dto/feedback.dto';
import { MailService } from '../mail/mail.service';
import { GraphQLClient } from 'graphql-request';
import { ConfigService } from '@nestjs/config';

interface ApprovalResponse {
  approveFeedback: {
    approved: boolean;
    reason: string;
  };
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private graphqlClient: GraphQLClient;

  constructor(
    @InjectModel('Feedback') private feedbackModel: Model<FeedbackDocument>,
    private mailService: MailService,
    private configService: ConfigService,
  ) {
    this.graphqlClient = new GraphQLClient(
      this.configService.get<string>('goServiceUrl')!,
    );
  }

  async create(createFeedbackInput: CreateFeedbackInput): Promise<FeedbackDocument> {
    try {

      const { approved, reason } = await this.checkFeedbackApproval(createFeedbackInput);

      if (!approved) {
        await this.mailService.sendRejectionEmail(
          createFeedbackInput.email,
          createFeedbackInput.name,
          createFeedbackInput.service,
          reason,
        );
        throw new Error('Feedback rejected, email sent to the user.');
      }

      const createdFeedback = new this.feedbackModel(createFeedbackInput);
      return createdFeedback.save();
    } catch (error) {
      this.logger.error(`Error processing feedback: ${error.message}`);
      throw new Error(`Error while processing feedback: ${error.message}`);
    }
  }

  private async checkFeedbackApproval(
    feedbackData: CreateFeedbackInput,
  ): Promise<{ approved: boolean; reason: string }> {
    const query = `
      mutation ApproveFeedback($feedbackData: FeedbackInput!) {
        approveFeedback(feedback: $feedbackData) {
          approved
          reason
        }
      }
    `;

    try {
      const response = await this.graphqlClient.request<ApprovalResponse>(
        query,
        { feedbackData },
      );
      return response.approveFeedback;
    } catch (error) {
      this.logger.error(`Error checking feedback approval: ${error.message}`);
      throw new Error(`Error checking feedback approval: ${error.message}`);
    }
  }
}


