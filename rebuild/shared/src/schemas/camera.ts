import { z } from 'zod';
import { isoDateSchema } from './common.js';

// ---------- 📷 الكاميرات والحضور بالوش ----------

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'الساعة غلط');

export const CAMERA_ROLES = ['in', 'out', 'inside'] as const;
export const cameraChannelInput = z.object({
  n: z.coerce.number().int().min(1).max(64),
  label: z.string().trim().max(40).default(''),
  role: z.enum(CAMERA_ROLES).default('inside'),
  /** the bridge only watches channels with this on */
  watch: z.boolean().default(true),
});

export const cameraConfigInput = z.object({
  on: z.boolean(),
  /** suggest = only store sightings and suggest; write = write real attendance */
  mode: z.enum(['suggest', 'write']),
  /** similarity from which a face counts as that worker (0–1) */
  threshold: z.coerce.number().min(0.3).max(0.95),
  /** «لسه ما جاش» alert time for shop workers who were not seen */
  absentAfter: hhmm,
  channels: z.array(cameraChannelInput).max(16),
});
export type CameraConfig = z.infer<typeof cameraConfigInput>;

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  on: false,
  mode: 'suggest',
  threshold: 0.6,
  absentAfter: '11:00',
  channels: [
    { n: 2, label: 'برّه (دخول)', role: 'in', watch: true },
    { n: 8, label: 'برّه (خروج)', role: 'out', watch: true },
  ],
};

export const facePhotoInput = z.object({
  staffId: z.string().min(1).max(64),
  photo: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(1_500_000),
});
export const nameSightingInput = z.object({ staffId: z.string().min(1).max(64) });
export const marketDayInput = z.object({ staffId: z.string().min(1).max(64), day: isoDateSchema.optional(), on: z.boolean().default(true) });

/** What the bridge posts when it sees a face. */
export const bridgeSeenInput = z.object({
  staffId: z.string().max(64).nullable().default(null),
  channel: z.coerce.number().int().min(1).max(64),
  score: z.coerce.number().min(0).max(1).default(0),
  at: z.string().datetime().optional(),
  snapshot: z.string().max(400_000).default(''),
  embedding: z.array(z.number()).max(2048).default([]),
});
export const bridgeEmbeddingInput = z.object({
  photoId: z.string().min(1).max(64),
  embedding: z.array(z.number()).max(2048).nullable(),
});
export const bridgeStatusInput = z.object({
  channels: z
    .array(z.object({ n: z.coerce.number().int().min(1).max(64), ok: z.boolean(), snapshot: z.string().max(400_000).default(''), note: z.string().max(200).default('') }))
    .max(16),
});

export interface FacePhotoDto {
  id: string;
  staffId: string;
  photo: string;
  status: 'pending' | 'ready' | 'noface';
}
export interface SightingDto {
  id: string;
  staffId: string | null;
  channel: number;
  score: number;
  at: string;
  snapshot: string;
}
export interface CameraChannelStatus {
  n: number;
  label: string;
  role: 'in' | 'out' | 'inside';
  watch: boolean;
  lastSnapAt: string | null;
  lastSeenAt: string | null;
  snapshot: string;
  note: string;
}
export interface CameraSuggestion {
  /** first sighting of the day */
  inAt: string | null;
  /** last sighting, once the worker was not seen again for gapHours */
  outAt: string | null;
  /** still inside the gap — may be seen again */
  outPending: boolean;
  seen: number;
}
export interface CameraStaffDay {
  staffId: string;
  name: string;
  place: 'shop' | 'market' | 'both';
  gapHours: number;
  market: boolean;
  faces: number;
  facesReady: number;
  suggestion: CameraSuggestion;
  attendance: { id: string; inAt: string | null; outAt: string | null; lateMin: number; method: string; snapshot: string } | null;
  late: boolean;
  notSeen: boolean;
}
export interface CameraOverview {
  day: string;
  config: CameraConfig;
  bridgeAt: string | null;
  channels: CameraChannelStatus[];
  staff: CameraStaffDay[];
  sightings: SightingDto[];
  unknown: SightingDto[];
}
