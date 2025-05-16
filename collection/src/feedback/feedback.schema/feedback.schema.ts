import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

@Schema({ timestamps: true })
export class Feedback {


  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  feedbackType: string;

  @Prop({ required: true })
  service: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  rating: number;

  @Prop({ default: false })
  attachScreenshot: boolean;

  @Prop({ required: true })
  agreeToTerms: boolean;

}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);