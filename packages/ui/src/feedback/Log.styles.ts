// Import Third-party Dependencies
import { css } from "lit";

export const logStyles = css`
  :host {
    --jolly-log-gap: var(--jolly-space-1, 4px);
    --jolly-log-max-width: 320px;
    --jolly-log-enter-duration: var(--jolly-duration-base, 160ms);
    --jolly-log-exit-duration: var(--jolly-duration-base, 160ms);
    --jolly-log-easing: var(--jolly-easing, ease);
    --jolly-log-color: var(--jolly-text, #e6edf3);
    --jolly-log-shadow: 0 1px 2px rgb(0 0 0 / 0.65);
    --jolly-log-rise: 4px;

    display: flex;
    flex-direction: column-reverse;
    max-width: var(--jolly-log-max-width);
    color: var(--jolly-log-color);
    font-family: var(--jolly-font-family, system-ui);
    font-size: var(--jolly-font-size, 13px);
    line-height: 1.35;
    pointer-events: none;
  }

  .row {
    display: grid;
    grid-template-rows: 1fr;
    opacity: 1;
    transform: translateY(0);
    transition:
      grid-template-rows var(--jolly-log-enter-duration)
        var(--jolly-log-easing),
      opacity var(--jolly-log-enter-duration) var(--jolly-log-easing),
      transform var(--jolly-log-enter-duration) var(--jolly-log-easing);
  }

  @starting-style {
    .row {
      grid-template-rows: 0fr;
      opacity: 0;
      transform: translateY(var(--jolly-log-rise));
    }
  }

  .row.leaving {
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateY(calc(-1 * var(--jolly-log-rise)));
    transition-duration: var(--jolly-log-exit-duration);
  }

  .content {
    min-height: 0;
    padding-block-start: var(--jolly-log-gap);
    overflow: hidden;
    overflow-wrap: anywhere;
    text-shadow: var(--jolly-log-shadow);
  }

  @media (prefers-reduced-motion: reduce) {
    .row {
      transition: none;
    }
  }
`;
