/**
 * Shared, client-safe types for the video generation surface.
 *
 * These live outside `src/modules/video/service.ts` on purpose: the server
 * service pulls in Drizzle and provider SDKs, so a component can't import
 * types from it without risking server code in the client bundle. Nothing in
 * this file imports anything.
 */

export type VideoStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'canceled';

export interface VideoAsset {
  videoUrl?: string;
  thumbnailUrl?: string;
}

/** One generation, as returned by `/api/video/tasks*`. */
export interface VideoTaskView {
  id: string;
  provider: string;
  model: string;
  modelLabel: string;
  prompt: string;
  status: string;
  /** True while the client should keep polling. */
  polling: boolean;
  videos: VideoAsset[];
  errorMessage: string;
  costCredits: number;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  generateAudio?: boolean;
  sourceImageUrl?: string;
  lastFrameUrl?: string;
  style?: string;
  cameraMovement?: string;
  shotSize?: string;
  createdAt: string;
  updatedAt: string;
}

/** Response shape of `GET /api/video/models`. */
export interface VideoModelsResponse {
  models: import('@/config/video-models').PublicVideoModel[];
  configuredProviders: string[];
  minCreditCost: number;
}
