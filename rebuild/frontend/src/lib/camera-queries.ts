'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CameraConfig, CameraOverview, FacePhotoDto, SightingDto } from '@mk/shared';
import { api } from './api';

export type Overview = CameraOverview & { since: string | null };

/** The camera screen refreshes itself: the bridge keeps posting while the owner looks. */
export const useCameraOverview = (day: string) =>
  useQuery({
    queryKey: ['camera', 'overview', day],
    queryFn: ({ signal }) => api.get<Overview>('/camera/overview', { day }, signal),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });

function useCamWrite<TVars, TRes>(fn: (v: TVars) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['camera'] });
      void qc.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

export const useSaveCameraConfig = () => useCamWrite((cfg: CameraConfig) => api.put<{ config: CameraConfig }>('/camera/config', cfg));
export const useFacePhotos = (staffId: string) =>
  useQuery({
    queryKey: ['camera', 'faces', staffId],
    queryFn: ({ signal }) => api.get<{ photos: FacePhotoDto[] }>(`/camera/faces/${staffId}`, undefined, signal).then((r) => r.photos),
    refetchInterval: 4000,
  });
export const useAddFace = () => useCamWrite((v: { staffId: string; photo: string }) => api.post<{ photo: FacePhotoDto }>('/camera/faces', v));
export const useDeleteFace = () => useCamWrite((id: string) => api.delete(`/camera/faces/${id}`));
export const getSighting = (id: string) => api.get<{ sighting: SightingDto }>(`/camera/sightings/${id}`).then((r) => r.sighting);
export const useDeleteSighting = () => useCamWrite((id: string) => api.delete(`/camera/sightings/${id}`));
export const useNameSighting = () => useCamWrite((v: { id: string; staffId: string }) => api.post(`/camera/sightings/${v.id}/name`, { staffId: v.staffId }));
export const useDismissSighting = () => useCamWrite((id: string) => api.post(`/camera/sightings/${id}/dismiss`));
export const useMarketDay = () => useCamWrite((v: { staffId: string; day: string; on: boolean }) => api.post('/camera/market', v));
export const useDeleteCamAttendance = () => useCamWrite((id: string) => api.delete(`/camera/attendance/${id}`));
