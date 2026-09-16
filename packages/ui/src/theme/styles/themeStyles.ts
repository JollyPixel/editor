// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { themeTokens } from "../tokens/semantic.ts";
import { densityTokens } from "../tokens/density.ts";
import { scaleTokens } from "../tokens/scales.ts";
import { ensureFontFace } from "../font.ts";

/*
 * The bundled face is part of the theme, so importing this module registers it.
 */
ensureFontFace();

// postcss-lit-disable-next-line
export const themeStyles = css`
  ${themeTokens}
  ${densityTokens}
  ${scaleTokens}
`;
