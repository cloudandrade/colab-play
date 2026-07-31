export const AVATAR_IDS = [
  "fox",
  "cat",
  "dog",
  "panda",
  "rabbit",
  "owl",
  "frog",
  "bear",
  "penguin",
  "chick",
  "monkey",
  "whale",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

export function avatarSrc(id: AvatarId | string): string {
  return `/avatars/${id}.svg`;
}

export const AVATAR_LABELS: Record<AvatarId, string> = {
  fox: "Raposa",
  cat: "Gato",
  dog: "Cachorro",
  panda: "Panda",
  rabbit: "Coelho",
  owl: "Coruja",
  frog: "Sapo",
  bear: "Urso",
  penguin: "Pinguim",
  chick: "Pintinho",
  monkey: "Macaco",
  whale: "Baleia",
};
