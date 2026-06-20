"use client";

import { buildFallbackAvatarUrl, buildInitials } from "@/lib/user-profile";

export interface UserAvatarProps {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-10 w-10 text-xs",
  md: "h-14 w-14 text-sm",
  lg: "h-20 w-20 text-lg",
} as const;

export default function UserAvatar({
  firstName,
  lastName,
  email,
  avatarUrl,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const initials = buildInitials(firstName, lastName, email);
  const src = avatarUrl?.trim() || buildFallbackAvatarUrl(firstName, lastName);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl ring-1 ring-blue-500/25 bg-blue-500/15 ${sizeClasses[size]} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${firstName} ${lastName}`.trim() || email}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
      />
      <span className="sr-only">{initials}</span>
    </div>
  );
}
