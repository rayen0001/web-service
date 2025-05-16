import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Feedback {


  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  feedbackType: string;

  @Field()
  service: string;

  @Field()
  message: string;

  @Field(() => Int)
  rating: number;

  @Field()
  attachScreenshot: boolean;

  @Field()
  agreeToTerms: boolean;

}