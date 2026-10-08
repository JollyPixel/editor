// Import Third-party Dependencies
import { svg } from "lit";
import { hashKey } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  registerIcon,
  type IconName
} from "../icon/registry.ts";

// CONSTANTS
const kGlyphs = [
  ["slime", "M12 3c3 3.5 8.5 7 8.5 11.5 0 3.5-2.5 6-8.5 6s-8.5-2.5-8.5-6C3.5 10 9 6.5 12 3ZM7.8 14a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0ZM12.8 14a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0Z"],
  ["cat", "M4 3.5l4.5 4h7l4.5-4V15c0 4-3.5 6.5-8 6.5S4 19 4 15ZM7.3 13.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0ZM13.3 13.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0Z"],
  ["bear", "M4.5 13.5a7.5 7.5 0 1 1 15 0a7.5 7.5 0 1 1-15 0ZM3 7a3 3 0 1 1 6 0a3 3 0 1 1-6 0ZM15 7a3 3 0 1 1 6 0a3 3 0 1 1-6 0ZM7.8 13a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0ZM12.8 13a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0Z"],
  ["bunny", "M6.5 4.5a1.75 1.75 0 0 1 3.5 0V11H6.5ZM14 4.5a1.75 1.75 0 0 1 3.5 0V11H14ZM5.5 15a6.5 6.5 0 1 1 13 0a6.5 6.5 0 1 1-13 0ZM7.9 14.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0ZM12.9 14.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0Z"],
  ["frog", "M3 15.5C3 12 5.5 10 8 10h8c2.5 0 5 2 5 5.5S17 21 12 21s-9-2-9-5.5ZM4 8.5a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0ZM13 8.5a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0ZM5.9 8.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0ZM14.9 8.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0Z"],
  ["ghost", "M5 11a7 7 0 0 1 14 0v9.5l-2.33-2-2.33 2-2.34-2-2.33 2-2.33-2-2.34 2ZM7.8 11a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0ZM12.8 11a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0Z"],
  ["robot", "M4 9.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM10.8 3.5h2.4V8h-2.4ZM10.2 3.5a1.8 1.8 0 1 1 3.6 0a1.8 1.8 0 1 1-3.6 0ZM7.75 12v3h2.75v-3ZM13.5 12v3h2.75v-3Z"],
  ["alien", "M12 3c4.7 0 8 3.2 8 7.5 0 5-4.8 10.5-8 10.5S4 15.5 4 10.5C4 6.2 7.3 3 12 3ZM6.75 10.57a2.5 1.6 35 1 0 4.1 2.86a2.5 1.6 35 1 0-4.1-2.86ZM17.25 10.57a2.5 1.6-35 1 0-4.1 2.86a2.5 1.6-35 1 0 4.1-2.86Z"],
  ["fox", "M3 3l5.5 4.5h7L21 3v7.5L12 21 3 10.5ZM7.15 11.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0ZM13.65 11.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0Z"]
] as const;
const kIconPrefix = "avatar-";

export type DefaultAvatar = typeof kGlyphs[number][0];

export const DEFAULT_AVATARS: readonly DefaultAvatar[] = kGlyphs.map(
  ([name]) => name
);

for (const [name, path] of kGlyphs) {
  registerIcon(
    `${kIconPrefix}${name}`,
    svg`<path d=${path} fill="currentColor" />`
  );
}

export function defaultAvatarIcon(
  peerId: string
): IconName {
  const avatar = DEFAULT_AVATARS[hashKey(peerId) % DEFAULT_AVATARS.length];

  return `${kIconPrefix}${avatar}`;
}
