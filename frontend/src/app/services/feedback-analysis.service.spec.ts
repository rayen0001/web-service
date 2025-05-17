import { TestBed } from '@angular/core/testing';

import { FeedbackAnalysisService } from './feedback-analysis.service';

describe('FeedbackAnalysisService', () => {
  let service: FeedbackAnalysisService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeedbackAnalysisService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
