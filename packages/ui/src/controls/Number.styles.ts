// Import Third-party Dependencies
import { css } from "lit";

// Import Internal Dependencies
import { scrubHandleStyles } from "../interaction/scrub/scrubHandle.styles.ts";

/**
 * The wrapper hosts the scrub handle over the native input.
 */
export const numberStyles = css`
  .wrap {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }

  /*
   * Match the base selector specificity for the padding override.
   */
  .value .wrap input:not([type="color"]) {
    padding-left: 10px;
  }

  ${scrubHandleStyles}
`;
