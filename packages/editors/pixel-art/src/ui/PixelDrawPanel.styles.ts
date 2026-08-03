// Import Third-party Dependencies
import { css } from "lit";

export const panelStyles = css`
  :host {
    display: flex;
    flex-direction: row;
    height: 100%;
  }

  .rail {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 56px;
    flex-shrink: 0;
    padding: 20px 0;
    gap: 10px;
    background: var(--color-bg-surface);
    color: var(--color-text);
    font-family: sans-serif;
    user-select: none;
  }

  .rail-divider {
    width: 32px;
    height: 1px;
    flex-shrink: 0;
    background: var(--color-divider);
  }

  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .canvas-host {
    /*
     * PixelArtCanvas.appendTo() sets this element's position to "relative"
     * inline (higher specificity than this stylesheet), so sizing must
     * come from width/height, not position:absolute + inset.
     */
    width: 100%;
    height: 100%;
  }

  .tool-option-overlay {
    position: absolute;
    top: 8px;
    left: 50%;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    background: var(--color-bg-overlay);
    color: var(--color-text);
    font-size: 11px;
    font-family: sans-serif;
    user-select: none;
    transform: translateX(-50%);
  }

  .tool-option-overlay input[type="range"] {
    width: 100px;
    cursor: pointer;
  }

  .tool-option-overlay span {
    width: 28px;
    text-align: right;
  }

  .tool-toggle-btn {
    padding: 2px 8px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: transparent;
    color: var(--color-text);
    font-size: 11px;
    cursor: pointer;
  }
  .tool-toggle-btn.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .uv-toolbar {
    position: absolute;
    bottom: 8px;
    left: 50%;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 12px;
    background: var(--color-bg-overlay);
    color: var(--color-text);
    font-size: 11px;
    font-family: sans-serif;
    user-select: none;
    transform: translateX(-50%);
  }

  .uv-toolbar button {
    padding: 3px 10px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: transparent;
    color: var(--color-text);
    font-size: 11px;
    cursor: pointer;
  }
  .uv-toolbar button:disabled {
    color: var(--color-border);
    cursor: default;
  }

  .uv-toolbar label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  .file-input {
    display: none;
  }
`;
