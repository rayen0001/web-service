import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideApollo, APOLLO_NAMED_OPTIONS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache } from '@apollo/client/core';
import { inject } from '@angular/core';
import { ApolloClient } from '@apollo/client/core';
import { routes } from './app.routes';

export function createNamedApollo(): { [key: string]: ApolloClient<any> } {
  const httpLink = inject(HttpLink);
  return {
    feedback5000: new ApolloClient({
      cache: new InMemoryCache(),
      link: httpLink.create({ uri: 'http://localhost:5000/graphql' }),
    }),
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideApollo(() => {
      const httpLink = inject(HttpLink);
      return {
        link: httpLink.create({ uri: 'http://localhost:4000/graphql' }),
        cache: new InMemoryCache(),
      };
    }),
    {
      provide: APOLLO_NAMED_OPTIONS,
      useFactory: createNamedApollo,
      deps: [HttpLink],
    },
  ],
};