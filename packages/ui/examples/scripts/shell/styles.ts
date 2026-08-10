/** Plain text, not a Lit `css` literal: the shell stays vanilla until P2. Reads tokens, declares none. */
export const shellStyles = `
  :host {
    display: block;
    height: 100%;
    background: var(--jolly-surface);
    color: var(--jolly-text);
    font-family: var(--jolly-font-family);
    font-size: var(--jolly-font-size);
  }

  .layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: 100%;
  }

  .layout[data-chrome="off"] {
    grid-template-columns: 1fr;
  }

  nav {
    overflow-y: auto;
    padding: var(--jolly-space-2);
    background: var(--jolly-surface-sunken);
    border-right: 1px solid var(--jolly-border);
  }

  .group-title {
    padding: var(--jolly-space-2) var(--jolly-space-2) var(--jolly-space-1);
    color: var(--jolly-text-muted);
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  a {
    display: block;
    padding: 0 var(--jolly-space-2);
    border-radius: var(--jolly-radius-sm);
    color: var(--jolly-text);
    line-height: var(--jolly-row-height);
    text-decoration: none;
    transition: background-color var(--jolly-duration-fast) var(--jolly-easing);
  }

  a:hover {
    background: var(--jolly-control-bg-hover);
  }

  a[aria-current="page"] {
    background: var(--jolly-accent-fill);
    color: var(--jolly-text-on-fill);
  }

  a:focus-visible {
    outline: 2px solid var(--jolly-focus-ring);
    outline-offset: 2px;
  }

  main {
    overflow: auto;
    padding: var(--jolly-space-4);
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

  .state-matrix {
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
`;
