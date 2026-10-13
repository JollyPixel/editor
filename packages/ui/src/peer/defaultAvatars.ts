/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { hashKey } from "@jolly-pixel/color";

export interface DefaultAvatar {
  name: string;
  face: string;
  eyes: string;
}

// CONSTANTS
export const DEFAULT_AVATARS: readonly DefaultAvatar[] = [
  {
    name: "slime",
    face: "M12 4.5c3.5 4 10 7 10 13V26H2v-8.5c0-6 6.5-9 10-13Z",
    eyes: "M6.6 16a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0ZM13.6 16a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0Z"
  },
  {
    name: "cat",
    face: "M4 4.5l5 4h6l5-4V26H4Z",
    eyes: "M6.6 15a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0ZM13.6 15a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0Z"
  },
  {
    name: "bear",
    face: "M3 15.5a9 9 0 1 1 18 0a9 9 0 1 1-18 0ZM2 7a3.2 3.2 0 1 1 6.4 0a3.2 3.2 0 1 1-6.4 0ZM15.6 7a3.2 3.2 0 1 1 6.4 0a3.2 3.2 0 1 1-6.4 0Z",
    eyes: "M7 15a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0ZM13.4 15a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0Z"
  },
  {
    name: "bunny",
    face: "M6.5 3.5a2 2 0 0 1 4 0V12h-4ZM13.5 3.5a2 2 0 0 1 4 0V12h-4ZM3.5 17.5a8.5 8.5 0 1 1 17 0a8.5 8.5 0 1 1-17 0Z",
    eyes: "M7.4 16.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0ZM13.2 16.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0Z"
  },
  {
    name: "frog",
    face: "M1.5 18c0-4 3.5-6.5 7-6.5h7c3.5 0 7 2.5 7 6.5v8h-21ZM3.5 9.5a3.8 3.8 0 1 1 7.6 0a3.8 3.8 0 1 1-7.6 0ZM12.9 9.5a3.8 3.8 0 1 1 7.6 0a3.8 3.8 0 1 1-7.6 0Z",
    eyes: "M5.6 9.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0ZM15 9.5a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0Z"
  },
  {
    name: "ghost",
    face: "M4.5 12a7.5 7.5 0 0 1 15 0v9.5l-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2Z",
    eyes: "M7.7 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0ZM12.7 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0Z"
  },
  {
    name: "robot",
    face: "M4 9.5A2.5 2.5 0 0 1 6.5 7h11A2.5 2.5 0 0 1 20 9.5V26H4ZM11 3.5h2V7h-2ZM10.2 3.5a1.8 1.8 0 1 1 3.6 0a1.8 1.8 0 1 1-3.6 0Z",
    eyes: "M7.3 12h3.2v3.2H7.3ZM13.5 12h3.2v3.2h-3.2Z"
  },
  {
    name: "alien",
    face: "M12 3c5 0 9 3.5 9 8.5 0 5.5-5 12.5-9 12.5S3 17 3 11.5C3 6.5 7 3 12 3Z",
    eyes: "M6.17 11.01a2.6 1.6 35 1 0 4.26 2.98a2.6 1.6 35 1 0-4.26-2.98ZM13.57 13.99a2.6 1.6-35 1 0 4.26-2.98a2.6 1.6-35 1 0-4.26 2.98Z"
  },
  {
    name: "fox",
    face: "M3.5 4l5.5 4.5h6L20.5 4v8.5L12 24 3.5 12.5Z",
    eyes: "M7.2 12.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0ZM13.6 12.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0Z"
  }
];

export function pickDefaultAvatar(
  peerId: string
): DefaultAvatar {
  return DEFAULT_AVATARS[hashKey(peerId) % DEFAULT_AVATARS.length];
}
