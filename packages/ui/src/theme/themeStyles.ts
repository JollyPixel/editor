// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { themeTokens } from "./tokens.ts";
import { densityTokens } from "./density.ts";
import { scaleTokens } from "./scales.ts";
import { ensureFontFace } from "./font.ts";

/*
 * A scope host is the thing that declares the theme, and the bundled face is
 * part of that theme, so importing this module registers it. The face has to
 * live on the document because a shadow root ignores "at font-face", and when
 * registration is skipped the family token falls back to the system mono stack.
 */
ensureFontFace();

/**
 * Theme, density, and scale styles for scope hosts.
 */
export const themeStyles = css`
  ${themeTokens}
  ${densityTokens}
  ${scaleTokens}
`;
