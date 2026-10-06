// Import Third-party Dependencies
import { css } from "lit";

export const consoleLogStyles = css`
  :host {
    display: block;
    position: absolute;
    right: 0;
    bottom: 100%;
    left: 0;
  }

  :host([hidden]) {
    display: none;
  }

  .scrollback {
    max-height: min(
      calc(var(--jolly-console-row) * 8),
      calc(var(--jolly-console-top) - 16px)
    );
    overflow-y: auto;
    padding: var(--jolly-space-1, 4px) 0;
    border-bottom: 1px solid var(--jolly-divider, rgb(255 255 255 / 8%));
    border-radius: var(--jolly-console-radius, 4px) var(--jolly-console-radius, 4px) 0 0;
    background: var(--jolly-console-bg);
    box-shadow: var(--jolly-console-shadow);
    transition: opacity var(--jolly-duration-base, 160ms) var(--jolly-easing, ease);
    scrollbar-color: var(--jolly-groove, rgb(255 255 255 / 20%)) transparent;
    scrollbar-width: thin;
  }

  @starting-style {
    .scrollback {
      opacity: 0;
    }
  }

  .entry {
    display: flex;
    gap: var(--jolly-space-2, 8px);
    align-items: baseline;
    min-height: var(--jolly-console-row);
    padding: 2px var(--jolly-space-3, 12px);
    box-sizing: border-box;
    content-visibility: auto;
    contain-intrinsic-block-size: auto var(--jolly-console-row);
    transition:
      opacity var(--jolly-duration-base, 160ms) var(--jolly-easing, ease),
      transform var(--jolly-duration-base, 160ms) var(--jolly-easing, ease);
  }

  @starting-style {
    .entry {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  .text {
    flex: 1 1 auto;
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  jolly-icon {
    flex: 0 0 auto;
    align-self: center;

    --jolly-icon-size: 10px;
  }

  .info {
    padding-inline-start: calc(var(--jolly-space-3, 12px) + 18px);
  }

  .echo {
    color: var(--jolly-text-muted, #9aa0a6);
  }

  .error {
    color: var(--jolly-danger, #ff6b6b);
  }

  .pending {
    color: var(--jolly-text-muted, #9aa0a6);
    animation: pending 1s ease-in-out infinite alternate;
  }

  @keyframes pending {
    from {
      opacity: 1;
    }

    to {
      opacity: 0.3;
    }
  }

  .fold {
    display: block;
    margin-top: 2px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--jolly-accent-text, #7aa7ff);
    font: inherit;
    cursor: pointer;
  }

  .fold:hover {
    text-decoration: underline;
  }

  .fold:focus-visible {
    outline: 1px solid var(--jolly-focus-ring, #3b82f6);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .scrollback,
    .entry {
      transition: none;
    }

    .pending {
      animation: none;
    }
  }
`;
