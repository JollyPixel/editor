/* eslint-disable @stylistic/max-len */
// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("pencil", svg`
  <path
    class="tone-ink"
    d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z"
    fill="currentColor"
  />
  <path
    d="M20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z"
    fill="currentColor"
  />
`, { tone: "pink" });

registerIcon("voxel-layer", svg`
  <path
    class="tone-fill"
    d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
  />
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M12 2L21 7V17L12 22L3 17V7L12 2ZM12 4.31L5.06 8.17L12 12.03L18.94 8.17L12 4.31ZM5 9.87V15.82L11 19.15V13.2L5 9.87ZM13 19.15L19 15.82V9.87L13 13.2V19.15Z"
    fill="currentColor"
  />
`, { tone: "violet" });

registerIcon("object-layer", svg`
  <path
    class="tone-ink"
    d="M10.5 3H9C7.34315 3 6 4.34315 6 6V9C6 10.1046 5.10457 11 4 11H3V13H4C5.10457 13 6 13.8954 6 15V18C6 19.6569 7.34315 21 9 21H10.5V19H9C8.44772 19 8 18.5523 8 18V15C8 13.8135 7.31672 12.7865 6.32297 12C7.31672 11.2135 8 10.1865 8 9V6C8 5.44772 8.44772 5 9 5H10.5V3Z"
    fill="currentColor"
  />
  <path
    class="tone-ink"
    d="M13.5 3H15C16.6569 3 18 4.34315 18 6V9C18 10.1046 18.8954 11 20 11H21V13H20C18.8954 13 18 13.8954 18 15V18C18 19.6569 16.6569 21 15 21H13.5V19H15C15.5523 19 16 18.5523 16 18V15C16 13.8135 16.6833 12.7865 17.677 12C16.6833 11.2135 16 10.1865 16 9V6C16 5.44772 15.5523 5 15 5H13.5V3Z"
    fill="currentColor"
  />
`, { tone: "teal" });

registerIcon("object-area", svg`
  <path
    class="tone-fill"
    d="M7.5 7.5h9v9h-9z"
  />
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M4 4H10V6H6V10H4V4ZM14 4H20V10H18V6H14V4ZM6 14V18H10V20H4V14H6ZM18 14H20V20H14V18H18V14Z"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("trash", svg`
  <path
    class="tone-fill"
    d="M6 7l1 13h10l1-13z"
  />
  <path
    d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "coral" });

registerIcon("copy", svg`
  <path
    class="tone-fill"
    d="M9 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9z"
  />
  <path
    d="M9 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("merge", svg`
  <path
    class="tone-fill"
    d="M3 16H21V21H3z"
  />
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M3 3H21V8H19V5H5V8H3V3ZM3 16H21V21H3V16ZM5 18V19H19V18H5ZM11 8V11H9L12 15L15 11H13V8H11Z"
    fill="currentColor"
  />
`, { tone: "violet" });

registerIcon("sliders", svg`
  <path
    d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M15 4v4M9 10v4M17 16v4"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("blocks", svg`
  <path
    class="tone-fill"
    d="M4 4h7v7H4zM13 13h7v7h-7z"
  />
  <path
    d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "amber" });

registerIcon("layers", svg`
  <path
    class="tone-fill"
    d="M12 3 21 8l-9 5-9-5 9-5z"
  />
  <path
    d="M12 3 21 8l-9 5-9-5 9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("order-usage", svg`
  <path
    d="M4 6h16M4 12h11M4 18h6"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

registerIcon("order-registry", svg`
  <path
    d="M4 6h16M4 12h16M4 18h16"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

registerIcon("template", svg`
  <path
    d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("template-save", svg`
  <path
    d="M5 4a1 1 0 0 1 1-1h8v2H7v12.3l5-3.2 5 3.2V11h2v10l-7-4.5L5 21V4Z"
    fill="currentColor"
  />
  <path
    class="tone-ink"
    d="M18 2h2v3h3v2h-3v3h-2V7h-3V5h3V2Z"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("stamp", svg`
  <path
    class="tone-ink"
    d="M9 3h6v5.5c0 1.2 1 2 2 2.5l1.5.8c.9.5 1.5 1.4 1.5 2.5V15H4v-.7c0-1.1.6-2 1.5-2.5l1.5-.8c1-.5 2-1.3 2-2.5V3Z"
    fill="currentColor"
  />
  <path
    d="M4 17h16v2H4z"
    fill="currentColor"
  />
`, { tone: "amber" });

registerIcon("rotate-ccw", svg`
  <path
    class="tone-ink"
    d="M5 12a7 7 0 1 0 2.05-4.95L4.5 9.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M4 4.5v5h5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("rotate-cw", svg`
  <path
    class="tone-ink"
    d="M19 12a7 7 0 1 1-2.05-4.95L19.5 9.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M20 4.5v5h-5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerIcon("flip-x", svg`
  <path
    class="tone-fill"
    d="M9.5 5.5v13H3.5z"
  />
  <path
    d="M9.5 5.5v13H3.5zM14.5 5.5v13h6z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M12 2.5v2.5M12 10.75v2.5M12 19v2.5"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "teal" });

registerIcon("flip-y", svg`
  <path
    class="tone-fill"
    d="M5.5 14.5h13v6z"
  />
  <path
    d="M5.5 14.5h13v6zM5.5 9.5h13V3.5z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M2.5 12h2.5M10.75 12h2.5M19 12h2.5"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "teal" });

registerIcon("flip-z", svg`
  <path
    class="tone-fill"
    d="M3.5 11.5 11.5 3.5 3.5 3.5z"
  />
  <path
    d="M3.5 11.5 11.5 3.5H3.5zM12.5 20.5 20.5 12.5v8z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M3 21l2-2M11 13l2-2M19 5l2-2"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "teal" });

registerIcon("transform", svg`
  <path
    class="tone-ink"
    d="M12 3v18M3 12h18"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
  <path
    d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "violet" });

registerIcon("rebase", svg`
  <path
    class="tone-fill"
    d="M7.5 9.5h7v7h-7z"
  />
  <path
    d="M7.5 9.5h7v7h-7z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M4 3v17h17"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M20.5 3.5 16 8M15.5 4.5v4h4"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "amber" });
