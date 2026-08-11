// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { themeTokens } from "./tokens.ts";
import { densityTokens } from "./density.ts";
import { scaleTokens } from "./scales.ts";

/**
 * Theme, density, and scale styles for scope hosts.
 */
export const themeStyles = css`
  ${themeTokens}
  ${densityTokens}
  ${scaleTokens}
`;
