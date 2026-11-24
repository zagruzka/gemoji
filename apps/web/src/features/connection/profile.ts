import { AVATAR_IDS, type AvatarId } from "@gemoji/shared";

const PROFILE_STORAGE_KEY = "gemoji_guest_profile";

export interface GuestProfile {
  nickname: string;
  avatar: AvatarId;
}

export function loadGuestProfile(): GuestProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestProfile>;
    if (
      typeof parsed.nickname === "string" &&
      parsed.nickname.trim().length >= 2 &&
      typeof parsed.avatar === "string" &&
      (AVATAR_IDS as readonly string[]).includes(parsed.avatar)
    ) {
      return {
        nickname: parsed.nickname.trim().slice(0, 16),
        avatar: parsed.avatar as AvatarId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveGuestProfile(profile: GuestProfile): void {
  localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      nickname: profile.nickname.trim().slice(0, 16),
      avatar: profile.avatar,
    }),
  );
}

export function randomAvatar(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)] ?? "fox";
}
