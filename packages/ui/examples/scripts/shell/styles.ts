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
    display: flex;
    height: 100%;
  }

  .layout[data-chrome="off"] {
    display: block;
  }

  jolly-dock {
    flex: 0 0 auto;
  }

  .gallery-pane {
    width: 100%;
    height: 100%;
  }

  .gallery-pane::part(header) {
    flex-wrap: wrap;
  }

  .gallery-pane::part(title) {
    flex-basis: 100%;
  }

  .gallery-pane::part(actions) {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }

  .gallery-pane > [slot="actions"] {
    --jolly-text-muted: color-mix(
      in oklab,
      var(--jolly-text-on-fill) 72%,
      transparent
    );

    flex: 1 1 96px;
    min-width: 96px;
    color: var(--jolly-text-on-fill);
  }

  nav {
    display: grid;
    gap: 1px;
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
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--jolly-space-4);
  }

  /* The composite scenarios are judged full bleed, so they drop the page inset. */
  main:has(> .editor-shell) {
    overflow: hidden;
    padding: 0;
  }

  .layout[data-chrome="off"] main:has(> .editor-shell) {
    height: 100%;
  }

  .editor-shell {
    display: flex;
    height: 100%;
    min-height: 520px;
    background: var(--jolly-surface-sunken);
  }

  /*
   * The gallery's own dock puts its resize grip 4px outside its right edge, which
   * would otherwise land on top of the example's rail. Clear it when the shell is
   * on; with chrome off there is no dock and no overhang to avoid.
   */
  .layout:not([data-chrome="off"]) .editor-shell {
    padding-inline-start: 4px;
  }

  /*
   * A dock's resize grip sits outside its edge, overhanging 4px into whatever sits
   * beside it. The stage has a dock on each side, so it reserves that room
   * rather than letting the grips land on the toolbar and viewport.
   */
  .editor-stage {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--jolly-space-2);
    min-width: 0;
    padding-block: var(--jolly-space-2);
    padding-inline: var(--jolly-space-3);
  }

  /* Without a basis the segments collapse to min-content and ellipsize. */
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

  .placement-stage {
    position: relative;
    display: flex;
    min-height: 480px;
    overflow: hidden;
    border: 1px solid var(--jolly-border);
  }

  .placement-stage > p {
    flex: 1 1 auto;
    padding: var(--jolly-space-4);
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
