// Import Third-party Dependencies
import { css } from "lit";

export const normalMapDockStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 8px 16px 12px;
    border-top: 1px solid var(--color-divider);
    background: var(--color-bg-surface);
    color: var(--color-text);
    font-family: var(--jolly-font-family, ui-monospace, monospace);
    font-size: 11px;
    gap: 6px;
    overflow: auto;
  }

  jolly-checkbox {
    --jolly-label-max-width: none;
  }

  h3 {
    display: flex;
    align-items: center;
    min-height: var(--jolly-control-height, 20px);
    margin: 0 0 2px;
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 600;
  }

  .toggle {
    margin-bottom: 8px;
  }

  .body {
    display: grid;
    grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
    gap: 16px;
    min-height: 0;
  }

  .zones ul {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    gap: 2px;
    list-style: none;
  }

  .zone {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    border-radius: 4px;
  }

  .zone.selected {
    background: color-mix(in srgb, var(--color-accent) 22%, transparent);
  }

  .zone-select {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: 4px 6px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: inherit;
    cursor: pointer;
    font: inherit;
    gap: 6px;
    text-align: left;
  }

  .zone-select:disabled {
    cursor: default;
  }

  .zone-select:hover:not(:disabled),
  .zone-select:focus-visible {
    background: var(--color-divider);
  }

  .zone-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .zone.orphaned .zone-name {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }

  .swatch {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px var(--color-border);
  }

  .tag {
    padding: 0 4px;
    border-radius: 3px;
    background: var(--color-divider);
    color: var(--color-text-muted);
    font-size: 10px;
  }

  .zone-delete,
  .reset {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .zone-delete:hover,
  .zone-delete:focus-visible,
  .reset:hover,
  .reset:focus-visible {
    background: var(--color-divider);
    color: var(--color-text);
  }

  .zone-delete .icon,
  .reset .icon {
    width: 14px;
    height: 14px;
  }

  .zone .note {
    grid-column: 1 / -1;
    margin: 0 6px 4px;
  }

  .settings {
    --jolly-label-width: 14ch;

    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 4px;
  }

  .settings > jolly-checkbox {
    --jolly-label-width: auto;
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    gap: 2px 16px;
  }

  .setting {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 2px;
  }

  .setting[data-setting="bevel"] {
    flex-wrap: wrap;
  }

  .setting > :not(.reset) {
    flex: 1 1 160px;
    min-width: 0;
  }

  .setting.inherited {
    --jolly-ink: var(--color-text-muted);
    --jolly-text: var(--color-text-muted);

    color: var(--color-text-muted);
  }

  .note {
    display: flex;
    align-items: flex-start;
    margin: 0;
    color: var(--color-text-muted);
    gap: 6px;
  }

  .body > .note {
    align-items: center;
    min-height: var(--jolly-control-height, 20px);
  }

  .zones > .note {
    margin: 6px 6px 0;
  }

  .note .icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .note.warning {
    color: light-dark(#9a5b00, #f0b45a);
  }
`;
