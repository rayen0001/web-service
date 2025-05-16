import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

@InputType()
export class CreateFeedbackInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  feedbackType: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  service: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  message: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @Field()
  @IsBoolean()
  attachScreenshot: boolean;

  @Field()
  @IsBoolean()
  @IsNotEmpty()
  agreeToTerms: boolean;
}
