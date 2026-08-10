/** Plain text, not a Lit `css` literal: these scope hosts stay vanilla until P2 brings a pane. */
export const scenarioStyles = `
  :host {
    display: grid;
    gap: var(--jolly-space-1);
    padding: var(--jolly-space-2);
    border: 1px solid var(--jolly-border);
    border-radius: var(--jolly-radius-md);
    background: var(--jolly-surface);
    color: var(--jolly-text);
    font-family: var(--jolly-font-family);
    font-size: var(--jolly-font-size);
    /* A pane stacks several different fields, unlike the one-field-per-row control gallery, so
       their labels need a shared column width or the value area starts at a different offset on
       every row. */
    --jolly-label-width: 8ch;
  }

  .scenario-name {
    color: var(--jolly-text-muted);
    font-size: 0.8em;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
`;
