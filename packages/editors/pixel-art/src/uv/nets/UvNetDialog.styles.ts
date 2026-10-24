// Import Third-party Dependencies
import { css } from "lit";

export const uvNetDialogStyles = css`
  .layout {
    display: grid;
    box-sizing: border-box;
    width: min(528px, calc(100vw - 72px));
    grid-template-columns: 168px minmax(0, 1fr);
    gap: 12px;
    height: min(480px, calc(100vh - 160px));
  }

  .nets {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding-right: 12px;
    border-right: 1px solid var(--color-divider);
  }

  .nets-header {
    display: flex;
    gap: 2px;
    align-items: center;
  }

  .nets-title {
    flex: 1;
    color: var(--color-text-muted);
  }

  .nets jolly-tree {
    flex: 1 1 auto;
    min-height: 0;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    overflow-y: auto;
  }

  .editor jolly-toggle {
    --jolly-field-inset-start: 0px;
    --jolly-field-inset-end: 0px;
  }

  .grid {
    display: grid;
    max-width: 100%;
    padding-bottom: 2px;
    overflow-x: auto;
    gap: 4px;
    justify-content: start;
  }

  .cell {
    display: flex;
    box-sizing: border-box;
    min-width: 52px;
    min-height: 40px;
    padding: 4px;
    border: 1px solid var(--color-divider);
    border-radius: 4px;
    gap: 3px;
    flex-wrap: wrap;
    align-content: flex-start;
  }

  .cell.edge {
    border-style: dashed;
    opacity: 0.6;
  }

  .cell.drop-target {
    border-color: var(--color-accent);
    opacity: 1;
  }

  .chip {
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--color-divider);
    color: var(--color-text-emphasis);
    font-size: 0.85em;
    line-height: 1.5;
    user-select: none;
  }

  .chip[draggable="true"] {
    cursor: grab;
  }

  .chip:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  .tray {
    display: flex;
    min-height: 26px;
    padding: 4px;
    border: 1px dashed var(--color-divider);
    border-radius: 4px;
    gap: 3px;
    flex-wrap: wrap;
    align-items: center;
  }

  .caption {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.85em;
  }

  .status {
    color: var(--color-danger, var(--color-text-muted));
  }

  .preview {
    --preview-color: #7aa2f7;

    position: relative;
    flex: none;
    max-width: 100%;
  }

  .preview-cell {
    display: flex;
    position: absolute;
    box-sizing: border-box;
    padding: 2px;
    overflow: hidden;
    border: 1px solid var(--preview-color);
    background: color-mix(in srgb, var(--preview-color) 30%, transparent);
    color: var(--color-text-emphasis);
    font-size: 0.85em;
    line-height: 1.2;
    gap: 0 4px;
    flex-wrap: wrap;
    place-content: center;
  }

  .preview-cell.shared {
    background: color-mix(in srgb, var(--preview-color) 55%, transparent);
  }

  .preview-cell span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
