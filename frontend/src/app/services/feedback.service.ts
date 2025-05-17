import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  constructor(private apollo: Apollo) {}

  getServices(): Observable<{ id: string; name: string }[]> {
    return this.apollo
      .query<any>({
        query: gql`
          query {
            getServices {
              id
              name
            }
          }
        `,
      })
      .pipe(map((result) => result.data.getServices));
  }

submitFeedback(data: {
  name: string;
  email: string;
  feedbackType: string;
  service: string;
  message: string;
  rating: number;
  attachScreenshot: boolean;
  agreeToTerms: boolean;
}): Observable<any> {
  return this.apollo.mutate({
    mutation: gql`
      mutation AddFeedback($createFeedbackInput: CreateFeedbackInput!) {
        addFeedback(createFeedbackInput: $createFeedbackInput) {
          name
          email
          message
          rating
          feedbackType
          service
          attachScreenshot
          agreeToTerms
        }
      }
    `,
    variables: {
      createFeedbackInput: data,
    },
  });
}

}