import type { User } from "@/types/auth";



export type StoredUserProfile = {

  firstName?: string;

  lastName?: string;

  avatarUrl?: string;

  resumeTemplateFileName?: string;

  resumeTemplateBase64?: string;

  customPrompt: string;

  promptFileName?: string;

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

    const legacyTemplateFile = parsed.resumeTemplate?.file;



    return {

      ...EMPTY_PROFILE,

      ...parsed,

      resumeTemplateFileName: parsed.resumeTemplateFileName ?? legacyTemplateName,

      customPrompt: parsed.customPrompt ?? "",

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

  };



  if (typeof window !== "undefined") {

    localStorage.setItem(profileKey(userId), JSON.stringify(next));

  }



  return next;

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

  const templateBase64 = await fileToBase64(file);

  saveStoredProfile(userId, {

    resumeTemplateFileName: file.name,

    resumeTemplateBase64: templateBase64,

  });

  return templateBase64;

}



export async function cacheUploadedPrompt(userId: string, file: File, content: string): Promise<void> {

  saveStoredProfile(userId, {

    customPrompt: content,

    promptFileName: file.name,

  });

}


