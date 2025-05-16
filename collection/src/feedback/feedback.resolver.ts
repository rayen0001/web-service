import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { FeedbackService } from './feedback.service';
import { Feedback } from './entities/feedback.entity/feedback.entity';
import { CreateFeedbackInput } from './dto/feedback.dto/feedback.dto';

@Resolver(() => Feedback)
export class FeedbackResolver {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Mutation(() => Feedback)
  async addFeedback(
    
    
    @Args('createFeedbackInput') createFeedbackInput: CreateFeedbackInput,
  ): Promise<Feedback> {
    console.log("Received input:", createFeedbackInput);

    const createdFeedback = await this.feedbackService.create(createFeedbackInput);
    return {

      name: createdFeedback.name,
      email: createdFeedback.email,
      feedbackType: createdFeedback.feedbackType,
      service: createdFeedback.service, 
      message: createdFeedback.message,
      rating: createdFeedback.rating,
      attachScreenshot: createdFeedback.attachScreenshot,
      agreeToTerms: createdFeedback.agreeToTerms,

    };
  }
  
}
