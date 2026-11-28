// Import Third-party Dependencies
import { registerIcon } from "@jolly-pixel/ui";

registerIcon("folder", `
  <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <rect x="6" y="25" width="52" height="30" rx="3" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#e39a1b" />
  <rect x="6" y="25" width="52" height="30" rx="3" fill="#ffc93c" />
`, { viewBox: "0 0 64 64" });

registerIcon("new-folder", `
  <g transform="translate(1 1) scale(.8)">
    <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <rect x="6" y="25" width="52" height="30" rx="3" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
    <path d="M6 15 a3 3 0 0 1 3 -3 H23 L28 17 H55 a3 3 0 0 1 3 3 V52 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#e39a1b" />
    <rect x="6" y="25" width="52" height="30" rx="3" fill="#ffc93c" />
  </g>
  <rect x="38" y="38" width="22" height="22" rx="5" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <rect x="38" y="38" width="22" height="22" rx="5" fill="#4cc35b" />
  <path d="M49 43 V55 M43 49 H55" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" />
`, { viewBox: "0 0 64 64" });

registerIcon("pencil", `
  <path
    class="tone-wash"
    d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"
  />
  <path
    class="tone-ink"
    d="M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("trash", `
  <path
    class="tone-wash"
    d="M6 7h12l-1 13H7L6 7Z"
  />
  <path
    class="tone-ink"
    d="M4 7h16M9 7V4h6v3M10 11v6M14 11v6"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    fill="none"
  />
`);

registerIcon("share", `
  <path
    class="tone-ink"
    d="M10.5 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    fill="none"
  />
  <path
    class="tone-ink"
    d="M13.5 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    fill="none"
  />
`);

registerIcon("users", `
  <path
    class="tone-wash"
    d="M9 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7ZM3 20a6 6 0 0 1 12 0Z"
  />
  <path
    class="tone-ink"
    d="M9 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7ZM3 20a6 6 0 0 1 12 0ZM15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.3A6 6 0 0 1 21 20"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("crown", `
  <path
    class="tone-ink"
    d="M3 7l5 5 4-7 4 7 5-5-2 12H5L3 7Z"
    fill="currentColor"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
  />
`);

registerIcon("file", `
  <path d="M14 5 H39 L51 17 V59 H14 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round" />
  <path d="M14 5 H39 L51 17 V59 H14 Z" fill="#8fd8ff" />
  <path d="M39 5 V17 H51 Z" fill="#d6f1ff" />
  <path d="M21 28 H43 M21 37 H43 M21 46 H35" stroke="#3f8fc0" stroke-width="3.5" stroke-linecap="round" />
`, { viewBox: "0 0 64 64" });

registerIcon("home", `
  <path
    class="tone-wash"
    d="M5 11v9h5v-6h4v6h5v-9"
  />
  <path
    class="tone-ink"
    d="M3 12l9-8 9 8M5 11v9h5v-6h4v6h5v-9"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    stroke-linecap="round"
    fill="none"
  />
`);

registerIcon("sign-out", `
  <path
    class="tone-wash"
    d="M4 4h8v16H4Z"
  />
  <path
    class="tone-ink"
    d="M12 4H4v16h8M10 12h10M16 8l4 4-4 4"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("export", `
  <path
    class="tone-wash"
    d="M4 15v5h16v-5"
  />
  <path
    class="tone-ink"
    d="M12 4v11M7 10l5 5 5-5M4 15v5h16v-5"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`, { tone: "sky" });

registerIcon("replace", `
  <path
    class="tone-wash"
    d="M4 15v5h16v-5"
  />
  <path
    class="tone-ink"
    d="M12 15V4M7 9l5-5 5 5M4 15v5h16v-5"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`, { tone: "sky" });

registerIcon("all-kinds", `
  <g fill="#2b1d16" stroke="#2b1d16" stroke-width="5" stroke-linejoin="round">
    <rect x="7" y="7" width="22" height="22" rx="5" />
    <rect x="35" y="7" width="22" height="22" rx="5" />
    <rect x="7" y="35" width="22" height="22" rx="5" />
    <rect x="35" y="35" width="22" height="22" rx="5" />
  </g>
  <rect x="7" y="7" width="22" height="22" rx="5" fill="#ff8a65" />
  <rect x="35" y="7" width="22" height="22" rx="5" fill="#ffc93c" />
  <rect x="7" y="35" width="22" height="22" rx="5" fill="#8fd8ff" />
  <rect x="35" y="35" width="22" height="22" rx="5" fill="#c79bff" />
`, { viewBox: "0 0 64 64" });

registerIcon("settings", `
  <path
    class="tone-wash"
    d="M9.7 5.18L9.82 2.24L14.18 2.24L14.3 5.18L16.76 6.6L19.36 5.23L21.54 9.01L19.06 10.58L19.06 13.42L21.54 14.99L19.36 18.77L16.76 17.4L14.3 18.82L14.18 21.76L9.82 21.76L9.7 18.82L7.24 17.4L4.64 18.77L2.46 14.99L4.94 13.42L4.94 10.58L2.46 9.01L4.64 5.23L7.24 6.6ZM15 12a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z"
    fill-rule="evenodd"
  />
  <path
    class="tone-ink"
    d="M9.7 5.18L9.82 2.24L14.18 2.24L14.3 5.18L16.76 6.6L19.36 5.23L21.54 9.01L19.06 10.58L19.06 13.42L21.54 14.99L19.36 18.77L16.76 17.4L14.3 18.82L14.18 21.76L9.82 21.76L9.7 18.82L7.24 17.4L4.64 18.77L2.46 14.99L4.94 13.42L4.94 10.58L2.46 9.01L4.64 5.23L7.24 6.6ZM15 12a3 3 0 1 0 -6 0a3 3 0 1 0 6 0Z"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("play", `
  <path d="M23 14.5 Q18 11.5 18 17.5 V46.5 Q18 52.5 23 49.5 L49 35 Q54 32 49 29 Z" fill="#2b1d16" stroke="#2b1d16" stroke-width="7" stroke-linejoin="round" />
  <path d="M23 14.5 Q18 11.5 18 17.5 V46.5 Q18 52.5 23 49.5 L49 35 Q54 32 49 29 Z" fill="#4cc35b" />
  <path d="M24 22 V31" stroke="#a8ecb1" stroke-width="3.5" stroke-linecap="round" />
`, { viewBox: "0 0 64 64" });

registerIcon("user", `
  <path
    class="tone-wash"
    d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18Z"
  />
  <path
    class="tone-ink"
    d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18ZM12 7a3 3 0 1 1 0 6a3 3 0 0 1 0-6ZM6.4 18.4a7 7 0 0 1 11.2 0"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("palette", `
  <path
    class="tone-wash"
    d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.2-1-1.6-1-2.6s.8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"
  />
  <path
    class="tone-ink"
    d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1.2-1-1.6-1-2.6s.8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    fill="none"
  />
  <circle class="tone-ink" cx="7.5" cy="11" r="1.75" fill="currentColor" />
  <circle class="tone-ink" cx="11" cy="7.5" r="1.75" fill="currentColor" />
  <circle class="tone-ink" cx="15.5" cy="8.5" r="1.75" fill="currentColor" />
`);

registerIcon("camera", `
  <path
    class="tone-wash"
    d="M5 7h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
  />
  <path
    class="tone-ink"
    d="M5 7h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM15 10.5l6-3.5v10l-6-3.5"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("key", `
  <path
    class="tone-wash"
    d="M8 10.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9Z"
  />
  <path
    class="tone-ink"
    d="M8 10.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9ZM11.2 11.8L20 3M16.5 6.5l3 3M13.5 9.5l2 2"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("shield", `
  <path
    class="tone-wash"
    d="M12 3v18c-4.6-1-8-4.5-8-9V6Z"
  />
  <path
    class="tone-ink"
    d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6ZM12 3v18"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("history", `
  <path
    class="tone-wash"
    d="M12 4a8 8 0 1 1 0 16a8 8 0 0 1 0-16Z"
  />
  <path
    class="tone-ink"
    d="M4 12a8 8 0 1 0 2.34-5.66L4 8.5M4 4v4.5h4.5M12 8v4.5l3 2"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("chat", `
  <path
    class="tone-wash"
    d="M3 4h12v9H8l-5 3.5Z"
  />
  <path
    class="tone-ink"
    d="M3 4h12v9H8l-5 3.5ZM18 9h3v8h-2v3l-3.5-3H11v-2"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`, { tone: "violet" });

registerIcon("send", `
  <path
    class="tone-wash"
    d="M4 4.5 20 12 4 19.5 6.5 12Z"
  />
  <path
    class="tone-ink"
    d="M4 4.5 20 12 4 19.5 6.5 12ZM6.5 12H12"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`);

registerIcon("web", `
  <path
    class="tone-wash"
    d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18Z"
  />
  <path
    class="tone-ink"
    d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18ZM3 12h18M12 3c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`, { tone: "sky" });

registerIcon("desktop", `
  <path
    class="tone-wash"
    d="M3 4h18v12H3Z"
  />
  <path
    class="tone-ink"
    d="M3 4h18v12H3ZM9 20h6M12 16v4"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`, { tone: "violet" });

registerIcon("mobile", `
  <path
    class="tone-wash"
    d="M7 3h10v18H7Z"
  />
  <path
    class="tone-ink"
    d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`, { tone: "lime" });

registerIcon("archive", `
  <path
    class="tone-wash"
    d="M4 9h16v11H4Z"
  />
  <path
    class="tone-ink"
    d="M3 4h18v5H3ZM4 9v11h16V9M10 13h4"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
`, { tone: "amber" });
