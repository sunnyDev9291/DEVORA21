"use client";

export type WatchVariant = "cool" | "warm";

export type WatchFaceProps = {
  variant?: WatchVariant;
  todayCount?: number | null;
  profileLabel?: string;
  generateDigital?: string | null;
};
