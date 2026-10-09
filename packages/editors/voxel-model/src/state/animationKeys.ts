// CONSTANTS
const kClipKey = /^clip:[^:]+:[^:]+$/;

export type SetKey = `set:${string}`;
export type ClipKey = `clip:${string}`;
export type AnimationKey = SetKey | ClipKey;

export interface ClipRef {
  setId: string;
  clipId: string;
}

export interface KeyRef {
  path: string;
  tick: number;
}

export function animationKey(setId: string): SetKey;
export function animationKey(setId: string, clipId: string): ClipKey;
export function animationKey(setId: string, clipId?: string | null): AnimationKey;
export function animationKey(
  setId: string,
  clipId: string | null = null
): AnimationKey {
  return clipId === null ? `set:${setId}` : `clip:${setId}:${clipId}`;
}

export function isClipKey(
  value: unknown
): value is ClipKey {
  return typeof value === "string" && kClipKey.test(value);
}
