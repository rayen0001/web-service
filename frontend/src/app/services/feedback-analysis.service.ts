import { Injectable, Inject } from '@angular/core';
import { gql } from 'apollo-angular';
import { ApolloClient } from '@apollo/client/core';
import { Observable, from } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { APOLLO_NAMED_OPTIONS } from 'apollo-angular';

interface KeyValuePair {
  key: string;
  value: number;
}

interface FeedbackAnalysis {
  averageRating: number;
  totalFeedback: number;
  feedbackTypeCounts: KeyValuePair[];
  sentimentCounts: KeyValuePair[];
}

interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

interface ServiceAnalysis {
  service: string;
  totalFeedback: number;
  averageRating: number;
  averageSentiment: number;
  sentimentBreakdown: SentimentBreakdown;
  topKeywords: string[];
}

interface FeedbackAnalysisResponse {
  feedbackAnalysis: any;
  data: {
    feedbackAnalysis: FeedbackAnalysis;
  };
}

interface ServiceAnalysisResponse {
  serviceAnalysis: any;
  data: {
    serviceAnalysis: ServiceAnalysis;
  };
}

@Injectable({
  providedIn: 'root',
})
export class FeedbackAnalysisService {
  constructor(
    @Inject(APOLLO_NAMED_OPTIONS) private namedOptions: { [key: string]: ApolloClient<any> }
  ) {}

  getFeedbackAnalysis(): Observable<FeedbackAnalysis> {
    const startTime = performance.now();
    return from(
      this.namedOptions['feedback5000'].query<FeedbackAnalysisResponse>({
        query: gql`
          query GetFeedbackAnalysis {
            feedbackAnalysis {
              averageRating
              totalFeedback
              feedbackTypeCounts {
                key
                value
              }
              sentimentCounts {
                key
                value
              }
            }
          }
        `,
      })
    ).pipe(
      tap(() => {
        const endTime = performance.now();
        console.log(`Feedback analysis response time: ${(endTime - startTime).toFixed(2)} ms`);
      }),
      map((result) => result.data.feedbackAnalysis)
    );
  }

  getServiceAnalysis(service: string): Observable<ServiceAnalysis> {
    const startTime = performance.now();
    return from(
      this.namedOptions['feedback5000'].query<ServiceAnalysisResponse>({
        query: gql`
          query GetServiceAnalysis($service: String!) {
            serviceAnalysis(service: $service) {
              service
              totalFeedback
              averageRating
              averageSentiment
              sentimentBreakdown {
                positive
                neutral
                negative
              }
              topKeywords
            }
          }
        `,
        variables: { service },
      })
    ).pipe(
      tap(() => {
        const endTime = performance.now();
        console.log(`Service analysis response time for "${service}": ${(endTime - startTime).toFixed(2)} ms`);
      }),
      map((result) => result.data.serviceAnalysis)
    );
  }
}
