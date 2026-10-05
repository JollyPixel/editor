// Import Third-party Dependencies
import { css } from "lit";

export const iconStyles = css`
  .icon {
    width: 21px;
    height: 21px;
    flex-shrink: 0;
  }

  .text-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: color-mix(
      in oklab,
      var(--jolly-icon-tone-color, currentcolor)
        var(--jolly-icon-tone-strength, var(--jolly-icon-tone-rest, 100%)),
      currentcolor
    );
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.1em;
    line-height: 1;
    text-indent: 0.1em;
  }
`;
