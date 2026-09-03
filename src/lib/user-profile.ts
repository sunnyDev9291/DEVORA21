import type { User } from "@/types/auth";
import {
  parseListingUrlsPartial,
  type JobCrawlPlatform,
} from "@/lib/builtin-crawl-types";

export type StoredUserProfile = {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  resumeTemplateFileName?: string;
  resumeTemplateBase64?: string;
  /** Set when the user uploads a new template — used to prefer local over stale remote copies. */
  resumeTemplateUpdatedAt?: number;
  customPrompt: string;
  promptFileName?: string;
  /** Per-user job crawl listing URLs. */
  listingUrls?: Partial<Record<JobCrawlPlatform, string>>;
};

export const LEGACY_TEMPLATE_STORAGE_KEY = "devora21-selected-resume-template";

const PROFILE_PREFIX = "devora21-user-profile:";

function profileKey(userId: string): string {
  return `${PROFILE_PREFIX}${userId}`;
}

const EMPTY_PROFILE: StoredUserProfile = {
  customPrompt: "",
};

export function loadStoredProfile(userId: string | undefined): StoredUserProfile {
  if (!userId || typeof window === "undefined") return { ...EMPTY_PROFILE };

  try {
    const raw = localStorage.getItem(profileKey(userId));
    if (!raw) return { ...EMPTY_PROFILE };
    const parsed = JSON.parse(raw) as Partial<StoredUserProfile> & {
      resumeTemplate?: { name?: string; file?: string };
      selectedPromptId?: string;
    };

    const legacyTemplateName = parsed.resumeTemplate?.name;
    const listingUrls = parseListingUrlsPartial(parsed.listingUrls);

    return {
      ...EMPTY_PROFILE,
      ...parsed,
      resumeTemplateFileName: parsed.resumeTemplateFileName ?? legacyTemplateName,
      customPrompt: parsed.customPrompt ?? "",
      listingUrls,
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveStoredProfile(userId: string, patch: Partial<StoredUserProfile>): StoredUserProfile {
  const current = loadStoredProfile(userId);
  const next: StoredUserProfile = {
    ...current,
    ...patch,
    customPrompt: patch.customPrompt !== undefined ? patch.customPrompt : current.customPrompt,
    listingUrls:
      patch.listingUrls !== undefined
        ? parseListingUrlsPartial(patch.listingUrls) ?? patch.listingUrls
        : current.listingUrls,
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(profileKey(userId), JSON.stringify(next));
  }

  return next;
}

export function resolveListingUrls(
  user: User | null | undefined,
  stored?: StoredUserProfile | null
): Partial<Record<JobCrawlPlatform, string>> | undefined {
  return parseListingUrlsPartial(stored?.listingUrls) ?? parseListingUrlsPartial(user?.listingUrls);
}



export function splitDisplayName(name: string): { firstName: string; lastName: string } {

  const trimmed = name.trim();

  const space = trimmed.indexOf(" ");

  if (space === -1) return { firstName: trimmed, lastName: "" };

  return {

    firstName: trimmed.slice(0, space),

    lastName: trimmed.slice(space + 1).trim(),

  };

}



export function resolveUserNames(user: User, stored?: StoredUserProfile | null): {

  firstName: string;

  lastName: string;

  fullName: string;

} {

  const email = user.email?.trim() ?? "";

  const emailLocalPart = email.includes("@") ? email.split("@")[0] : email;



  const firstName =

    stored?.firstName?.trim() ||

    user.firstName?.trim() ||

    splitDisplayName(user.name ?? "").firstName ||

    emailLocalPart;



  const lastName =

    stored?.lastName?.trim() ||

    user.lastName?.trim() ||

    splitDisplayName(user.name ?? "").lastName;



  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || user.name?.trim() || email;



  return { firstName, lastName, fullName };

}



export function resolveAvatarUrl(user: User, stored?: StoredUserProfile | null): string | null {

  const direct = stored?.avatarUrl?.trim() || user.avatar?.trim();

  if (direct) return direct;

  return null;

}



export function buildInitials(firstName: string, lastName: string, email: string): string {

  const a = firstName.trim()[0]?.toUpperCase() ?? "";

  const b = lastName.trim()[0]?.toUpperCase() ?? "";

  if (a && b) return `${a}${b}`;

  if (a) return a;

  return email.trim()[0]?.toUpperCase() ?? "?";

}



export function buildFallbackAvatarUrl(firstName: string, lastName: string): string {

  const name = encodeURIComponent([firstName, lastName].filter(Boolean).join(" ") || "User");

  return `https://ui-avatars.com/api/?name=${name}&background=2563eb&color=ffffff&size=128&bold=true`;

}



export async function cacheUploadedTemplate(userId: string, file: File): Promise<string> {

  const { fileToBase64 } = await import("@/lib/profile-file");
  const { PROFILE_TEMPLATE_UPDATED_EVENT } = await import("@/lib/template-fingerprint");

  const templateBase64 = await fileToBase64(file);

  saveStoredProfile(userId, {

    resumeTemplateFileName: file.name,

    resumeTemplateBase64: templateBase64,

    resumeTemplateUpdatedAt: Date.now(),

  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_TEMPLATE_UPDATED_EVENT));
  }

  return templateBase64;

}



export async function cacheUploadedPrompt(userId: string, file: File, content: string): Promise<void> {

  saveStoredProfile(userId, {

    customPrompt: content,

    promptFileName: file.name,

  });

}


