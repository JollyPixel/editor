// Import Internal Dependencies
import BrushManager from "../BrushManager.js";

export interface BrushControlsOptions {
  brush: BrushManager;
  colorPickerId?: string;
  brushSizeId?: string;
  brushOpacityId?: string;
}

export class BrushControls {
  private brush: BrushManager;
  private colorPicker: HTMLInputElement | null;
  private brushSizeInput: HTMLInputElement | null;
  private brushSizeValue: HTMLElement | null;
  private brushOpacityInput: HTMLInputElement | null;
  private brushOpacityValue: HTMLElement | null;

  constructor(options: BrushControlsOptions) {
    this.brush = options.brush;
    this.colorPicker = document.getElementById(options.colorPickerId || "colorPicker") as HTMLInputElement;
    this.brushSizeInput = document.getElementById(options.brushSizeId || "brushSize") as HTMLInputElement;
    this.brushSizeValue = document.getElementById("brushSizeValue");
    this.brushOpacityInput = document.getElementById(options.brushOpacityId || "brushOpacity") as HTMLInputElement;
    this.brushOpacityValue = document.getElementById("brushOpacityValue");

    this.init();
  }

  private init(): void {
    // Color picker
    if (this.colorPicker) {
      this.colorPicker.addEventListener("input", () => {
        this.brush.setColor(this.colorPicker!.value);
      });
    }

    // Brush size
    if (this.brushSizeInput && this.brushSizeValue) {
      this.brushSizeInput.value = String(this.brush.getSize());
      this.brushSizeInput.addEventListener("input", () => {
        const size = Number(this.brushSizeInput!.value);
        this.brush.setSize(size);
        this.brushSizeValue!.textContent = `${size}px`;
      });
      this.brushSizeValue.textContent = `${this.brush.getSize()}px`;
    }

    // Brush opacity
    if (this.brushOpacityInput && this.brushOpacityValue) {
      this.brushOpacityInput.addEventListener("input", () => {
        const opacity = Number(this.brushOpacityInput!.value) / 100;
        this.brush.setOpacity(opacity);
        this.brushOpacityValue!.textContent = `${this.brushOpacityInput!.value}%`;
      });
    }
  }
}
