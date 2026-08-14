// Import Third-party Dependencies
import { css } from "lit";

export const progressStyles = css`
  :host {
    --jolly-progress-height: 4px;
    --jolly-progress-track: var(--jolly-groove, rgb(0 0 0 / 0.2));
    --jolly-progress-fill: var(--jolly-accent-fill, #4488ff);
    --jolly-progress-duration: var(--jolly-duration-base, 160ms);
    --jolly-progress-easing: var(--jolly-easing, ease);
    --jolly-progress-track-shadow: none;
    --jolly-progress-shadow: none;
    --jolly-progress-shadow-active: var(--jolly-progress-shadow);

    display: block;
    width: 100%;
  }

  :host([hidden]) {
    display: none;
  }

  .track {
    position: relative;
    height: var(--jolly-progress-height);
    overflow: hidden;
    border-radius: calc(var(--jolly-progress-height) / 2);
    background: var(--jolly-progress-track);
    box-shadow: var(--jolly-progress-track-shadow);
  }

  .indicator {
    position: absolute;
    inset: 0;
    background: var(--jolly-progress-fill);
    box-shadow: var(--jolly-progress-shadow);
    transform: scaleX(var(--jolly-progress-ratio, 0));
    transform-origin: left center;
    transition:
      transform var(--jolly-progress-duration)
      var(--jolly-progress-easing);
    will-change: transform;
  }

  :host([animated]:not([completed])) .indicator {
    animation: progress-pulse 1.5s ease-in-out infinite;
  }

  :host([animated]:not([completed])) .indicator::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgb(255 255 255 / 0.15) 30%,
      rgb(255 255 255 / 0.4) 50%,
      rgb(255 255 255 / 0.15) 70%,
      transparent 100%
    );
    animation: progress-shimmer 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  :host([animated]:not([completed])) .indicator::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgb(255 255 255 / 0.2) 0%,
      transparent 50%,
      rgb(0 0 0 / 0.1) 100%
    );
  }

  :host([animated]:not([completed])) .indicator.speeding {
    animation: progress-speed 300ms ease;
  }

  .track.indeterminate .indicator {
    width: 45%;
    animation: progress-indeterminate 1.2s ease-in-out infinite;
    transform: translateX(-120%);
  }

  @keyframes progress-pulse {
    0%, 100% {
      box-shadow: var(--jolly-progress-shadow);
    }
    50% {
      box-shadow: var(--jolly-progress-shadow-active);
    }
  }

  @keyframes progress-shimmer {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }

  @keyframes progress-speed {
    0%, 100% {
      filter: blur(0);
    }
    50% {
      filter: blur(1px);
    }
  }

  @keyframes progress-indeterminate {
    0% {
      transform: translateX(-120%);
    }
    50% {
      transform: translateX(120%);
    }
    100% {
      transform: translateX(280%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .indicator,
    .indicator::before {
      animation: none !important;
      transition-duration: 0ms;
    }

    .track.indeterminate .indicator {
      width: 100%;
      opacity: 0.55;
      transform: none;
    }
  }

  @media (forced-colors: active) {
    .track {
      border: 1px solid CanvasText;
      background: Canvas;
    }

    .indicator {
      background: Highlight;
      forced-color-adjust: none;
    }
  }
`;
