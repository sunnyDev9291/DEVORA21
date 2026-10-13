"use client";

import { useEffect, useState } from "react";
import { absolutizeMediaUrl, buildInitials } from "@/lib/user-profile";

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
  const resolved = avatarUrl?.trim() ? absolutizeMediaUrl(avatarUrl) : "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const showImage = Boolean(resolved) && !failed;
  const label = `${firstName} ${lastName}`.trim() || email || "User";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl ring-1 ring-teal-500/20 bg-gradient-to-br from-teal-600 to-slate-800 ${sizeClasses[size]} ${className}`}
      aria-label={label}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={label}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-semibold tracking-wide text-white"
          aria-hidden
        >
          {initials}
        </span>
      )}
    </div>
  );
}
