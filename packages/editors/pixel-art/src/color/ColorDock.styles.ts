// Import Third-party Dependencies
import { css } from "lit";

export const colorDockStyles = css`
  :host {
    --jolly-surface-raised: var(--color-bg-surface);

    container-type: inline-size;
    display: flex;
    align-items: center;
    justify-content: safe center;
    overflow: hidden;
    gap: 16px;
    min-width: 0;
    box-sizing: border-box;
    padding: 14px 16px;
    border-top: 1px solid var(--color-divider);
    background: var(--color-bg-surface);
    color: var(--color-text);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: 11px;
  }

  .palette {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    flex: 0 1 auto;
    max-width: 40%;
  }

  .palette-tools {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .tool .icon {
    width: 14px;
    height: 14px;
  }

  .tool:hover:not(:disabled),
  .tool[aria-expanded="true"] {
    --jolly-icon-tone-strength: var(--jolly-icon-tone-engaged, 100%);

    color: var(--color-text-emphasis);
  }

  .tool:focus-visible {
    outline: 2px solid var(--color-accent, #48f);
    outline-offset: 1px;
  }

  .tool:disabled {
    opacity: 0.4;
    cursor: default;
  }

  jolly-color-picker {
    height: 100%;
    flex: 0 1 440px;
  }

  .strips {
    display: grid;
    gap: 10px;
    flex: 0 1 auto;
    min-width: 82px;
  }

  .strips-toggle {
    display: none;
  }

  .strips-popover {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 8px;
    border: none;
    border-radius: var(--jolly-radius-md, 6px);
    background: var(--color-bg-surface, Canvas);
    box-shadow: var(--jolly-shadow-overlay);
    color: var(--color-text);
    font: inherit;
  }

  .strips-popover:popover-open {
    display: grid;
    gap: 10px;
  }

  @container (max-width: 760px) {
    :host {
      gap: 12px;
    }

    .strips {
      gap: 6px;
    }

    .strips color-strip {
      --color-strip-label-display: none;
    }
  }

  @container (max-width: 560px) {
    .strips {
      display: none;
    }

    .strips-toggle {
      display: flex;
      align-self: flex-start;
    }
  }

  @container (max-width: 460px) {
    jolly-color-picker {
      --jolly-picker-fields-display: none;
      --jolly-picker-channels-align: end;
    }
  }

  @container (max-width: 380px) {
    jolly-color-picker {
      --jolly-picker-channels-display: none;
    }
  }
`;
