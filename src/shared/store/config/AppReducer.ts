import { ReducersMapObject } from '@reduxjs/toolkit';
import { UTApi } from '@/shared/api/UTApi/api';
import { StateSchema } from './types';
import { RTKApi } from '@/shared/api/RTKApi/api';
import { authReducer } from '@/shared/auth/model/slice';

export const RootReducer: ReducersMapObject<StateSchema> = {
  [RTKApi.reducerPath]: RTKApi.reducer,
  [UTApi.reducerPath]: UTApi.reducer,
  auth: authReducer,
};
