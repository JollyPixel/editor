// Import Third-party Dependencies
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui";

// CONSTANTS
const kTop = "M12 3 20 7.5 12 12 4 7.5Z";
const kLeft = "M4 7.5 12 12 12 21 4 16.5Z";
const kRight = "M12 12 20 7.5 20 16.5 12 21Z";
const kOutline = [
  "M12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5Z",
  "M4 7.5 12 12 20 7.5",
  "M12 12V21"
].join(" ");

function axisIcon(
  opacity: [number, number, number]
) {
  const [top, left, right] = opacity;

  return svg`
    <path d=${kTop} fill="currentColor" fill-opacity=${top} />
    <path d=${kLeft} fill="currentColor" fill-opacity=${left} />
    <path d=${kRight} fill="currentColor" fill-opacity=${right} />
    <path
      d=${kOutline}
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  `;
}

registerIcon("brush-build", svg`
  <path
    d="M10 3 17 7v8l-7 4-7-4V7Z M3 7l7 4 7-4 M10 11v8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <path
    d="M19 14v7M15.5 17.5h7"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
  />
`);

registerIcon("brush-replace", svg`
  <path
    d="M12 7 17 10v5l-5 3-5-3v-5Z M7 10l5 3 5-3 M12 13v5"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  />
  <path
    d="M4 9a9 9 0 0 1 14.5-5.2M20 15a9 9 0 0 1-14.5 5.2"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
  />
  <path
    d="M19.5 1v3.5H16M4.5 23v-3.5H8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);

registerIcon("axis-xz", axisIcon([0.9, 0, 0]));
registerIcon("axis-xy", axisIcon([0, 0.9, 0]));
registerIcon("axis-yz", axisIcon([0, 0, 0.9]));
registerIcon("axis-xyz", axisIcon([0.9, 0.6, 0.35]));

registerIcon("pattern-square", svg`
  <rect
    x="5"
    y="5"
    width="14"
    height="14"
    rx="1.5"
    fill="currentColor"
    fill-opacity="0.25"
    stroke="currentColor"
    stroke-width="1.75"
  />
`);

registerIcon("pattern-circle", svg`
  <circle
    cx="12"
    cy="12"
    r="7.5"
    fill="currentColor"
    fill-opacity="0.25"
    stroke="currentColor"
    stroke-width="1.75"
  />
`);
