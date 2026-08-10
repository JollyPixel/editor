// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { themeTokens } from "./tokens.ts";
import { densityTokens } from "./density.ts";
import { scaleTokens } from "./scales.ts";

/**
 * Tokens, density and scales for a scope host: `static styles = [themeStyles, ownStyles]`.
 * Leaf components consume tokens and declare none.
 */
export const themeStyles = css`
  ${themeTokens}
  ${densityTokens}
  ${scaleTokens}
`;
