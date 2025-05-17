import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackResolver } from './feedback.resolver';

describe('FeedbackResolver', () => {
  let resolver: FeedbackResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeedbackResolver],
    }).compile();

    resolver = module.get<FeedbackResolver>(FeedbackResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
