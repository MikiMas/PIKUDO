const HALF_HOUR_MS = 30 * 60 * 1000;

export function getBlockStartFromAnchor(date: Date, anchor: Date): Date {
  const nowMs = date.getTime();
  const anchorMs = anchor.getTime();
  if (nowMs <= anchorMs) return new Date(anchorMs);
  const blocks = Math.floor((nowMs - anchorMs) / HALF_HOUR_MS);
  return new Date(anchorMs + blocks * HALF_HOUR_MS);
}

export function secondsToNextBlockFromAnchor(date: Date, anchor: Date): number {
  const blockStart = getBlockStartFromAnchor(date, anchor);
  const next = new Date(blockStart.getTime() + HALF_HOUR_MS);
  return Math.max(0, Math.ceil((next.getTime() - date.getTime()) / 1000));
}

// Default behaviour: 30-min blocks anchored to 01:00 local time.
export function getBlockStart(date: Date = new Date()): Date {
  const now = new Date(date.getTime());
  const anchor = new Date(now.getTime());
  anchor.setHours(1, 0, 0, 0);
  if (now.getTime() < anchor.getTime()) anchor.setDate(anchor.getDate() - 1);
  return getBlockStartFromAnchor(now, anchor);
}

export function secondsToNextBlock(date: Date = new Date()): number {
  const now = new Date(date.getTime());
  const anchor = new Date(now.getTime());
  anchor.setHours(1, 0, 0, 0);
  if (now.getTime() < anchor.getTime()) anchor.setDate(anchor.getDate() - 1);
  return secondsToNextBlockFromAnchor(now, anchor);
}

// Back-compat exports used across the app (old name).
export const getBlockStartUTC = getBlockStart;

