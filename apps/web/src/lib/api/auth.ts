'use client';
/**
 * Query keys and hooks for sign-in, registration, verification and password reset
 * (`cms-panel-shell.T01`; `owner-auth.API01`–`API07`, `account-registration.API01`–`API05`).
 * Types come from `packages/contracts`, so the screens and the API share one definition
 * (`int-standards.nextjs.md` → State and data).
 *
 * Only the signed-in `user` is cached; tokens never reach the client (`owner-auth` → Session
 * contract). A one-time-code `reference` lives in the calling screen's state, never in a cache
 * or a URL (`cms-panel-shell.AC15`).
 */
import type {
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  OtpIssuedResponse,
  RegisterRequest,
  RegistrationOptionsResponse,
  ResendOtpRequest,
  ResetPasswordRequest,
  VerificationCodeRequest,
  VerificationResendRequest,
  VerifyEmailRequest,
} from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from './context';

export const authKeys = {
  me: ['auth', 'me'] as const,
  registrationOptions: ['auth', 'registration-options'] as const,
};

/** The signed-in user (`owner-auth.API04`); a 401 means "not signed in". */
export function useMe() {
  const api = useApiClient();
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => (await api.request<{ user: AuthUser }>('/auth/me')).user,
    retry: false,
    staleTime: 60_000,
  });
}

/** Signs in (`owner-auth.API01`) and caches the user. */
export function useLogin() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: LoginRequest) =>
      (await api.request<{ user: AuthUser }>('/auth/login', { method: 'POST', body: credentials })).user,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

/** Signs out (`owner-auth.API03`) and drops every cached CMS query. */
export function useLogout() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.request<undefined>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

/** Whether to show the owner-key field and the Google button (`account-registration.API01`). */
export function useRegistrationOptions() {
  const api = useApiClient();
  return useQuery({
    queryKey: authKeys.registrationOptions,
    queryFn: () => api.request<RegistrationOptionsResponse>('/auth/registration/options'),
    staleTime: 60_000,
  });
}

/** `account-registration.API02`. */
export function useRegister() {
  const api = useApiClient();
  return useMutation({
    mutationFn: (request: RegisterRequest) =>
      api.request<OtpIssuedResponse>('/auth/register', { method: 'POST', body: request }),
  });
}

/** `account-registration.API03` — verifies and signs in; caches the user. */
export function useVerifyEmail() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: VerifyEmailRequest) =>
      (await api.request<{ user: AuthUser }>('/auth/register/verify', { method: 'POST', body: request })).user,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

/** `account-registration.API04`. */
export function useRequestVerificationCode() {
  const api = useApiClient();
  return useMutation({
    mutationFn: (request: VerificationCodeRequest) =>
      api.request<OtpIssuedResponse>('/auth/verification/request', { method: 'POST', body: request }),
  });
}

/** `account-registration.API05`. */
export function useResendVerificationCode() {
  const api = useApiClient();
  return useMutation({
    mutationFn: (request: VerificationResendRequest) =>
      api.request<OtpIssuedResponse>('/auth/verification/resend', { method: 'POST', body: request }),
  });
}

/** `owner-auth.API05`. */
export function useForgotPassword() {
  const api = useApiClient();
  return useMutation({
    mutationFn: (request: ForgotPasswordRequest) =>
      api.request<OtpIssuedResponse>('/auth/password/forgot', { method: 'POST', body: request }),
  });
}

/** `owner-auth.API06`. */
export function useResendResetCode() {
  const api = useApiClient();
  return useMutation({
    mutationFn: (request: ResendOtpRequest) =>
      api.request<OtpIssuedResponse>('/auth/password/resend', { method: 'POST', body: request }),
  });
}

/** `owner-auth.API07`. */
export function useResetPassword() {
  const api = useApiClient();
  return useMutation({
    mutationFn: (request: ResetPasswordRequest) =>
      api.request<undefined>('/auth/password/reset', { method: 'POST', body: request }),
  });
}
