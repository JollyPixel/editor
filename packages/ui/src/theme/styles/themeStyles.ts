// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { themeTokens } from "../tokens/semantic.ts";
import { densityTokens } from "../tokens/density.ts";
import { scaleTokens } from "../tokens/scales.ts";
import { ensureFontFace } from "../font.ts";

ensureFontFace();

export const themeStyles = css`
  ${themeTokens}
  ${densityTokens}
  ${scaleTokens}
`;
