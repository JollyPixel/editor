// Import Third-party Dependencies
import { LitElement, css, html } from "lit";

// Import Internal Dependencies
import type ThreeSceneManager from "../three/ThreeSceneManager.js";

export class PopupManager extends LitElement {
  private sceneManager: ThreeSceneManager | null = null;

  static override styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
    }

    :host(.active) {
      display: flex;
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;

  override firstUpdated() {
    // No need to query .container since we use slot now
  }

  public show(component: HTMLElement) {
    // Clear existing children and add the new component
    this.innerHTML = "";
    this.appendChild(component);
    this.classList.add("active");
    if (this.sceneManager) {
      this.sceneManager.setControlsEnabled(false);
    }
  }

  public hide() {
    this.classList.remove("active");
    this.innerHTML = "";
    if (this.sceneManager) {
      this.sceneManager.setControlsEnabled(true);
    }
  }

  public setSceneManager(sceneManager: ThreeSceneManager): void {
    this.sceneManager = sceneManager;
  }

  override render() {
    return html`
      <div class="overlay">
        <div class="container">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

customElements.define("jolly-popup-manager", PopupManager);
