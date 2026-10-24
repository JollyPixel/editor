// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

export type TextureIconName = "lineTabs";

registerIcon("lineTabs", svg`
    <path
      d="M4 5h16"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
    />
    <rect
      x="3"
      y="10"
      width="18"
      height="10"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
    />
  `);
