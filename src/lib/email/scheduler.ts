import type { Profile } from "@/lib/types";

const MALAYSIA_UTC_OFFSET = 8; // MYT = UTC+8
const WINDOW_MINUTES      = 5;

export function shouldSendDigest(profile: Profile): boolean {
  if (!profile.email_digest_enabled) return false;

  const now = new Date();
  const currentUtcHour   = now.getUTCHours();
  const currentUtcMinute = now.getUTCMinutes();

  // digest_time is stored as "HH:MM:SS" in Malaysia local time (MYT)
  const parts = (profile.digest_time ?? "08:00").split(":").map(Number);
  const mytHour   = parts[0] ?? 8;
  const mytMinute = parts[1] ?? 0;

  // Convert MYT → UTC
  const utcHour   = ((mytHour - MALAYSIA_UTC_OFFSET) + 24) % 24;
  const utcMinute = mytMinute;

  if (utcHour !== currentUtcHour) return false;
  return Math.abs(utcMinute - currentUtcMinute) <= WINDOW_MINUTES;
}
