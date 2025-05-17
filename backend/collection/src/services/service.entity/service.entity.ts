import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Service {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;
}