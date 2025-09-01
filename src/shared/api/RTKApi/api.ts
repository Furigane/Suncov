import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Relative base URL to the same-origin backend defined in server/index.js
// All RTK queries should use paths like `/tests`, `/dictants`, etc. which will
// resolve to `/api/<path>` via this base.
export const RTKApiURL: string = '/api';

export const RTKApi = createApi({
  reducerPath: 'RTKApi',
  baseQuery: fetchBaseQuery({ baseUrl: RTKApiURL }),
  endpoints: () => ({}),
});

