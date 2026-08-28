/** Styles for content rendered inside the gallery, distinct from its navigation shell. */
export const exampleStyles = `
  main:has(.editor-shell) {
    overflow: hidden;
    padding: 0;
  }

  .layout[data-chrome="off"] main:has(.editor-shell) {
    height: 100%;
  }

  .editor-shell {
    display: flex;
    height: 100%;
    min-height: 520px;
    background: var(--jolly-surface-sunken);
  }

  .layout:not([data-chrome="off"]) .editor-shell {
    padding-inline-start: 4px;
  }

  .editor-stage {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--jolly-space-2);
    min-width: 0;
    padding-block: var(--jolly-space-2);
    padding-inline: var(--jolly-space-3);
  }

  .editor-stage jolly-button-group {
    flex: 0 0 auto;
    width: 220px;
  }

  .editor-viewport {
    display: grid;
    flex: 1 1 auto;
    min-height: 0;
    border-radius: var(--jolly-radius-md);
    background: var(--jolly-surface);
    color: var(--jolly-text-muted);
    place-items: center;
  }

  .token-grid {
    display: grid;
    gap: var(--jolly-space-1);
  }

  .token-row {
    display: flex;
    gap: var(--jolly-space-2);
    align-items: center;
  }

  .token-swatch {
    width: 48px;
    height: var(--jolly-row-height);
    border: 1px solid var(--jolly-border-strong);
    border-radius: var(--jolly-radius-sm);
  }

  code {
    color: var(--jolly-text-muted);
    font-variant-numeric: var(--jolly-font-numeric);
  }

  .peer-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jolly-space-2);
  }

  .peer-chip {
    display: grid;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--jolly-text-on-fill);
    place-items: center;
    transition: transform var(--jolly-duration-fast) var(--jolly-easing);
  }

  .peer-chip.is-active {
    transform: scale(1.25);
  }

  .state-matrix,
  .chrome-demo {
    --jolly-label-width: 14ch;
  }

  .state-matrix {
    --jolly-field-trailing-width: 48px;
    --jolly-gutter-width: 14px;

    display: grid;
    gap: var(--jolly-space-3);
    max-width: 520px;
  }

  .state-row {
    display: grid;
    gap: var(--jolly-space-1);
  }

  .chrome-demo {
    display: grid;
    gap: var(--jolly-space-4);
    max-width: 520px;
  }

  .chrome-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--jolly-space-2);
    align-items: center;
  }

  .scenario-grid {
    display: grid;
    gap: var(--jolly-space-3);
    max-width: 520px;
  }

  .prop-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--jolly-space-1);
  }

  .placement-stage,
  .dock-layout-stage {
    position: relative;
    display: flex;
    overflow: hidden;
    border: 1px solid var(--jolly-border);
  }

  .placement-stage {
    height: 480px;
  }

  .dock-layout-stage {
    height: 520px;
  }

  .placement-viewport {
    flex: 1 1 auto;
    padding: var(--jolly-space-4);
  }

  .dock-layout-viewport {
    flex: 1 1 auto;
    margin: 0;
    padding: var(--jolly-space-4);
    color: var(--jolly-text-muted);
  }

  .dock-layout-stage jolly-dock[overlay] {
    position: absolute;
  }

  .dock-transparent-stage {
    position: relative;
    display: flex;
    height: 520px;
    overflow: hidden;
    border: 1px solid var(--jolly-border);
  }

  .dock-transparent-stage jolly-dock[overlay] {
    position: absolute;
  }

  .dock-transparent-viewport {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--jolly-text-muted);
    background-image:
      linear-gradient(45deg, var(--jolly-border) 25%, transparent 25%),
      linear-gradient(-45deg, var(--jolly-border) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--jolly-border) 75%),
      linear-gradient(-45deg, transparent 75%, var(--jolly-border) 75%);
    background-size: 24px 24px;
    background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  }

  .scenario-hint {
    margin: 0;
    color: var(--jolly-text-muted);
  }

  .scenario-log {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: var(--jolly-space-2);
    border: 1px solid var(--jolly-border);
    border-radius: var(--jolly-radius-sm);
    background: var(--jolly-surface-sunken);
    list-style: none;
    font-variant-numeric: var(--jolly-font-numeric);
  }

  .scenario-log li[data-kind="change"] {
    color: var(--jolly-accent-text);
  }

  .scenario-log li[data-kind="input"] {
    color: var(--jolly-text-muted);
  }

  .state-name {
    color: var(--jolly-text-muted);
    font-size: 0.8em;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .progress-example {
    display: grid;
    gap: var(--jolly-space-5);
    max-width: 720px;
  }

  .progress-states,
  .progress-simulator {
    display: grid;
    gap: var(--jolly-space-3);
  }

  .progress-state {
    display: grid;
    grid-template-columns: 12ch minmax(180px, 1fr);
    gap: var(--jolly-space-3);
    align-items: center;
  }

  .loading-preview {
    position: relative;
    min-height: 360px;
    overflow: hidden;
    border: 1px solid var(--jolly-border);
    border-radius: var(--jolly-radius-md);
  }

  .loading-preview jolly-loading {
    font-size: 16px;
  }
`;
