// Import Third-party Dependencies
import { css } from "lit";

export const spinnerStyles = css`
  :host {
    --jolly-spinner-size: 1em;
    --jolly-spinner-thickness: 2px;
    --jolly-spinner-color: currentcolor;
    --jolly-spinner-track: color-mix(
      in srgb,
      var(--jolly-spinner-color) 24%,
      transparent
    );
    --jolly-spinner-duration: 700ms;

    display: inline-flex;
    vertical-align: middle;
  }

  .spinner {
    box-sizing: border-box;
    width: var(--jolly-spinner-size);
    height: var(--jolly-spinner-size);
    border: var(--jolly-spinner-thickness) solid var(--jolly-spinner-track);
    border-top-color: var(--jolly-spinner-color);
    border-radius: 50%;
    animation: spinner-rotate var(--jolly-spinner-duration) linear infinite;
  }

  @keyframes spinner-rotate {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes spinner-pulse {
    0%, 100% {
      opacity: 0.35;
    }

    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      border-color: var(--jolly-spinner-color);
      animation: spinner-pulse 1.4s ease-in-out infinite;
    }
  }

  @media (forced-colors: active) {
    .spinner {
      border-color: Canvas;
      border-top-color: CanvasText;
      forced-color-adjust: none;
    }
  }
`;
