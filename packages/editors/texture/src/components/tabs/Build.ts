// Import Third-party Dependencies
import { LitElement, css, html } from "lit";
import { query } from "lit/decorators.js";

// Import Internal Dependencies
import CanvasManager from "../../texture/CanvasManager.ts";

export class Build extends LitElement {
  @query("#texturePreview")
  declare texturePreviewElement: HTMLDivElement;

  @query("#textureSizeX")
  declare textureSizeXElement: HTMLSelectElement;

  @query("#textureSizeY")
  declare textureSizeYElement: HTMLSelectElement;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      gap: 5px;

      box-sizing: border-box;
    }

    section {
      display: flex;
      flex-direction: column;
      width: 100%;
      background: orange;
      box-sizing: border-box;
      border: 2px solid #222;
      border-radius: 5px;
    }

    #build {
      padding: 5px;
    }

    ul {
      height: 30px;
      width: 100%;
      margin: 0;
      padding: 0;
      display: flex;
      background: blue;

      box-sizing: border-box;

      border: 2px solid #222;
      border-radius: 5px;

      list-style: none;
    }

    ul > li {
      flex: 1;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: #AAA;
      border: 2px solid #CCC;
    }

    ul > li:hover {
      color: #fff;
      cursor: pointer;
      background: #444;
    }

    #axis-input-row  {
      display: flex;
      gap: 5px;
      margin-top: 10px;
    }

    #axis-input-row  > .axis-input {
      position: relative;
      flex: 1;
      height: 40px;
      display: flex;
    }

    #axis-input-row > .axis-input > input {
      flex: 1;
      border-radius: 5px;
      padding-left: 15px;
      box-sizing: border-box;
      width: 100%;
      border: 2px solid #AAA;
      border-radius: 5px;
    }

    #axis-input-row  > .axis-input > .color-indicator {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 10px;
      height: 10px;
      border-top-left-radius: 3px;
      z-index: 10;
    }

    #axis-input-row  > .axis-input:nth-child(1) > .color-indicator {
      border-top: 3px solid #ff0000;
      border-left: 3px solid #ff0000;
    }

    #axis-input-row  > .axis-input:nth-child(2) > .color-indicator {
      border-top: 3px solid #00ff00;
      border-left: 3px solid #00ff00;
    }

    #axis-input-row > .axis-input:nth-child(3) > .color-indicator {
      border-top: 3px solid #0000ff;
      border-left: 3px solid #0000ff;
    }

    #texture {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-height: 300px;
      padding-top: 5px;
    }

    #texture > .setting-row {
      padding: 0 5px;
      display: flex;
      box-sizing: border-box;
      gap: 5px;
    }
    #texture > .setting-row > label {
      margin-right: 10px;
    }

    #texturePreview {
      position: relative;
      flex: 1;
      width: 100%;
      min-height: 200px;
      background: #AAA;
      box-sizing: border-box;
    }
  `;

  private getLeftPanel(): any {
    const rootNode = this.getRootNode() as ShadowRoot;

    return rootNode?.host;
  }

  private getCanvasManager(): CanvasManager | null {
    const leftPanel = this.getLeftPanel();

    if (!leftPanel || typeof leftPanel.getSharedCanvasManager !== "function") {
      return null;
    }

    return leftPanel.getSharedCanvasManager();
  }

  private handleTextureSizeChange(): void {
    const manager = this.getCanvasManager();

    if (!manager || !this.textureSizeXElement || !this.textureSizeYElement) {
      return;
    }

    const x = parseInt(this.textureSizeXElement.value, 10);
    const y = parseInt(this.textureSizeYElement.value, 10);

    manager.setTextureSize({ x, y });
  }

  override updated(): void {
    const manager = this.getCanvasManager();

    if (!manager) {
      console.warn("Build: No canvas manager available");

      return;
    }

    if (!this.texturePreviewElement) {
      console.error("Build: texturePreview element not found");

      return;
    }

    const rect = this.texturePreviewElement.getBoundingClientRect();

    if ((rect.width > 0) && (rect.height > 0)) {
      manager.reparentCanvasTo(this.texturePreviewElement);
    }
  }

  override render() {
    return html`
      <section id="build">
        <ul>
          <li>Pos</li>
          <li>Angle</li>
          <li>Size</li>
          <li>Pivot</li>
          <li>Scale</li>
        </ul>

        <div id="axis-input-row">
          <div class="axis-input">
            <input type="number" id="x" name="x" />
            <div class="color-indicator"></div>
          </div>
          <div class="axis-input">
            <input type="number" id="y" name="y" />
            <div class="color-indicator"></div>
          </div>
          <div class="axis-input">
            <input type="number" id="z" name="z" />
            <div class="color-indicator"></div>
          </div>
        </div>
      </section>


      <section id="texture">
        <div class="setting-row">
          <label>Texture Size</label>
          <select id="textureSizeX" name="textureSizeX" @change="${this.handleTextureSizeChange}">
            <option value="16">16</option>
            <option value="32">32</option>
            <option value="64">64</option>
            <option value="128">128</option>
            <option value="256">256</option>
            <option value="512">512</option>
            <option value="1024">1024</option>
            <option value="2048">2048</option>
          </select>
          <select id="textureSizeY" name="textureSizeY" @change="${this.handleTextureSizeChange}">
            <option value="16">16</option>
            <option value="32">32</option>
            <option value="64">64</option>
            <option value="128">128</option>
            <option value="256">256</option>
            <option value="512">512</option>
            <option value="1024">1024</option>
            <option value="2048">2048</option>
          </select>
        </div>
        <div class="setting-row">
          <label for="unwrapMode">Unwrap Mode</label>
          <select id="unwrapMode" name="unwrapMode">
            <option value="complete">Complete</option>
            <option value="stack">Stack</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div class="setting-row">
          <ul>
            <li>0°</li>
            <li>90°</li>
            <li>180°</li>
            <li>270°</li>
          </ul>
          <button>H</button>
          <button>V</button>
        </div>

        <div id="texturePreview"></div>
      </section>
    `;
  }
}

customElements.define("jolly-model-editor-build", Build);
