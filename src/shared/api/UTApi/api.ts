import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const UTApiURL: string = 'https://api.uploadthing.com/v6';

export const UTApi = createApi({
  reducerPath: 'UTApi',
  baseQuery: fetchBaseQuery({
    baseUrl: UTApiURL,
    prepareHeaders: (headers) => {
      headers.set('Content-Type', 'application/json');
      headers.set('X-Uploadthing-Api-Key', "sk_live_a67bd5fdcae20fad94e564b18dbadee61652b8a8a92d2a3d74e5164a4d40a213");
      return headers;
    },
  }),
  endpoints: () => ({}),
});
