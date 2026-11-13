// Import Third-party Dependencies
import {
  svg,
  type SVGTemplateResult
} from "lit";

// Import Internal Dependencies
import {
  hasIcon,
  registerIcon,
  type BuiltinIconName,
  type RegisterIconOptions
} from "./registry.ts";

function registerBuiltin(
  name: BuiltinIconName,
  glyph: SVGTemplateResult,
  options: RegisterIconOptions = {}
): void {
  if (!hasIcon(name)) {
    registerIcon(name, glyph, options);
  }
}

registerBuiltin("chevron", svg`
  <path
    d="M8.5 5.5 16 12l-7.5 6.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerBuiltin("settings", svg`
  <path
    d="M4 8h16M4 16h16"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
  <circle cx="9" cy="8" r="3" fill="currentColor" />
  <circle cx="15" cy="16" r="3" fill="currentColor" />
`);

registerBuiltin("close", svg`
  <path
    d="M6 6l12 12M18 6 6 18"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

registerBuiltin("plus", svg`
  <path
    class="tone-ink"
    d="M12 5v14M5 12h14"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`, { tone: "lime" });

registerBuiltin("revert", svg`
  <path
    d="M3 12a9 9 0 1 0 3-6.7L3 8"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M3 3v5h5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerBuiltin("drag", svg`
  <path
    d="M3 12h18"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
  <path
    d="M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerBuiltin("lock", svg`
  <rect
    x="4.5"
    y="10.5"
    width="15"
    height="10"
    rx="2"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linejoin="round"
  />
  <path
    d="M8 10.5V7.5a4 4 0 0 1 8 0v3"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

registerBuiltin("eye", svg`
  <path
    d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="2.25" />
`);

registerBuiltin("search", svg`
  <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.25" />
  <path
    d="m15 15 4.5 4.5"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
  />
`);

registerBuiltin("folder", svg`
  <path
    d="M4 7.5a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linejoin="round"
  />
`);

registerBuiltin("check", svg`
  <path
    d="m5 12.5 4.5 4.5L19 7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.25"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerBuiltin("info", svg`
  <circle cx="12" cy="12" r="9" fill="currentColor" />
  <path
    d="M12 10.5v6"
    fill="none"
    stroke="var(--jolly-surface, Canvas)"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <circle cx="12" cy="7.5" r="1.35" fill="var(--jolly-surface, Canvas)" />
`);

registerBuiltin("warning", svg`
  <path
    d="M12 4.25 21.5 20.5h-19Z"
    fill="currentColor"
  />
  <path
    d="M12 9.75v4.75"
    fill="none"
    stroke="var(--jolly-surface, Canvas)"
    stroke-width="2.5"
    stroke-linecap="round"
  />
  <circle cx="12" cy="17.4" r="1.35" fill="var(--jolly-surface, Canvas)" />
`);

registerBuiltin("error", svg`
  <circle cx="12" cy="12" r="9" fill="currentColor" />
  <path
    d="m9 9 6 6m0-6-6 6"
    fill="none"
    stroke="var(--jolly-surface, Canvas)"
    stroke-width="2.5"
    stroke-linecap="round"
  />
`);

registerBuiltin("eyedropper", svg`
  <path
    d="M14.5 4.5a2.5 2.5 0 0 1 3.5 0l1.5 1.5a2.5 2.5 0 0 1 0 3.5L17 12l-5-5Z"
    fill="currentColor"
  />
  <path
    d="M12.5 8.5 5 16v3h3l7.5-7.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`);

registerBuiltin("trash", svg`
  <path
    class="tone-ink"
    d="M4 7h16"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
  />
  <path
    class="tone-ink"
    d="M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
  <path
    class="tone-ink"
    d="M6.5 7 7.3 19.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
  <path
    class="tone-ink"
    d="M10 11v6M14 11v6"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`, { tone: "coral" });

registerBuiltin("undo", svg`
  <path class="tone-ink" d="M8.5 4 3 9l5.5 5Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M7 9h7.5a5 5 0 0 1 0 10H10"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerBuiltin("redo", svg`
  <path class="tone-ink" d="M15.5 4 21 9l-5.5 5Z" fill="currentColor" />
  <path
    class="tone-ink"
    d="M17 9H9.5a5 5 0 0 0 0 10H14"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "teal" });

registerBuiltin("duplicate", svg`
  <rect
    class="tone-fill"
    x="9"
    y="9"
    width="12"
    height="12"
    rx="2"
    stroke="currentColor"
    stroke-width="1.5"
  />
  <path
    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerBuiltin("pencil", svg`
  <mask id="pencil-ferrule-cut">
    <rect width="24" height="24" fill="#fff" />
    <path d="M13.2 6.3l4.5 4.5" stroke="#000" stroke-width="1.6" />
  </mask>
  <path
    class="tone-ink"
    d="M15.5 3.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L9 20l-5.5 1.5L5 16 15.5 3.5Z"
    fill="currentColor"
    mask="url(#pencil-ferrule-cut)"
  />
`, { tone: "pink" });

registerBuiltin("play", svg`
  <path
    class="tone-fill"
    d="M7 4.5v15l12-7.5z"
  />
  <path
    d="M7 4.5v15l12-7.5z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerBuiltin("pause", svg`
  <rect
    class="tone-fill"
    x="6"
    y="5"
    width="4"
    height="14"
    rx="1"
  />
  <rect
    class="tone-fill"
    x="14"
    y="5"
    width="4"
    height="14"
    rx="1"
  />
  <path
    d="M7 5h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <path
    d="M15 5h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "coral" });

registerBuiltin("stop", svg`
  <rect
    class="tone-fill"
    x="6"
    y="6"
    width="12"
    height="12"
    rx="1.5"
  />
  <rect
    x="6"
    y="6"
    width="12"
    height="12"
    rx="1.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
`, { tone: "coral" });

registerBuiltin("loop", svg`
  <path
    d="M9 17H7.5a4.5 4.5 0 0 1 0-9h9a4.5 4.5 0 0 1 0 9H12M14.5 14.5 12 17l2.5 2.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });

registerBuiltin("import", svg`
  <path
    class="tone-ink"
    d="M12 4v11M7.5 10.5 12 15l4.5-4.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "lime" });

registerBuiltin("export", svg`
  <path
    class="tone-ink"
    d="M12 15V4M7.5 8.5 12 4l4.5 4.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`, { tone: "sky" });
