'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuditEntry,
  ChangePasswordInput,
  CreateUserInput,
  ListAuditQuery,
  ListUsersQuery,
  LoginInput,
  Paginated,
  PublicUser,
  SettingKey,
  SettingsMap,
  SetupInput,
  UpdateUserInput,
} from '@mk/shared';
import { api } from './api';

export const keys = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  users: (q: Partial<ListUsersQuery>) => ['users', q] as const,
  audit: (q: Partial<ListAuditQuery>) => ['audit', q] as const,
};

type UserRes = { user: PublicUser };

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: ({ signal }) => api.get<UserRes>('/auth/me', undefined, signal).then((r) => r.user),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<UserRes>('/auth/login', input).then((r) => r.user),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup'],
    queryFn: ({ signal }) => api.get<{ needsSetup: boolean }>('/auth/setup', undefined, signal).then((r) => r.needsSetup),
  });
}

export function useSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetupInput) => api.post<UserRes>('/auth/setup', input).then((r) => r.user),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>('/auth/logout'),
    onSettled: () => qc.clear(),
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      api.post<UserRes>('/auth/change-password', input).then((r) => r.user),
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: ({ signal }) =>
      api.get<{ settings: SettingsMap }>('/settings', undefined, signal).then((r) => r.settings),
    staleTime: 5 * 60_000,
  });
}

export function useSaveSetting<K extends SettingKey>(key: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: SettingsMap[K]) =>
      api.put<{ key: K; value: SettingsMap[K] }>(`/settings/${key}`, value).then((r) => r.value),
    onSuccess: (value) => {
      qc.setQueryData<SettingsMap>(keys.settings, (old) => (old ? { ...old, [key]: value } : old));
    },
  });
}

export function useUsers(query: Partial<ListUsersQuery>) {
  return useQuery({
    queryKey: keys.users(query),
    queryFn: ({ signal }) => api.get<Paginated<PublicUser>>('/users', query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api.post<UserRes>('/users', input).then((r) => r.user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      api.patch<UserRes>(`/users/${id}`, input).then((r) => r.user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<UserRes>(`/users/${id}`).then((r) => r.user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api.post<{ ok: true }>(`/users/${id}/reset-password`, { newPassword }),
  });
}

export function useAudit(query: Partial<ListAuditQuery>) {
  return useQuery({
    queryKey: keys.audit(query),
    queryFn: ({ signal }) => api.get<Paginated<AuditEntry>>('/audit', query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api.get<{ ok: boolean; time: string }>('/health', undefined, signal),
    refetchInterval: 60_000,
  });
}
