// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

export class MockCanvasRenderingContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern = "#000000";
  strokeStyle: string | CanvasGradient | CanvasPattern = "#000000";
  lineWidth = 1;
  lineJoin: CanvasLineJoin = "miter";
  font = "";
  textAlign: CanvasTextAlign = "left";
  textBaseline: CanvasTextBaseline = "alphabetic";

  fillTextCallCount = 0;
  lastFillText = "";
  lastStrokeText = "";
  roundRectCallCount = 0;
  arcCallCount = 0;
  fillCallCount = 0;
  strokeCallCount = 0;

  clearRect(..._args: unknown[]): void {
    return void 0;
  }

  fillRect(..._args: unknown[]): void {
    return void 0;
  }

  beginPath(): void {
    return void 0;
  }

  closePath(): void {
    return void 0;
  }

  moveTo(..._args: unknown[]): void {
    return void 0;
  }

  lineTo(..._args: unknown[]): void {
    return void 0;
  }

  roundRect(..._args: unknown[]): void {
    this.roundRectCallCount++;
  }

  arc(..._args: unknown[]): void {
    this.arcCallCount++;
  }

  fill(): void {
    this.fillCallCount++;
  }

  stroke(): void {
    this.strokeCallCount++;
  }

  fillText(
    text: string
  ): void {
    this.fillTextCallCount++;
    this.lastFillText = text;
  }

  strokeText(
    text: string
  ): void {
    this.lastStrokeText = text;
  }
}

export function installCanvasMock(
  doc: Document
): void {
  const createElement = doc.createElement.bind(doc);
  Object.assign(doc, {
    createElement(
      tagName: string,
      options?: ElementCreationOptions
    ) {
      const element = createElement(tagName, options);
      if (tagName.toLowerCase() === "canvas") {
        const context = new MockCanvasRenderingContext2D();
        Object.assign(element, {
          getContext: (type: string) => (
            type === "2d" ? context : null
          )
        });
      }

      return element;
    }
  });
}

export function contextOf(
  sprite: THREE.Sprite
): MockCanvasRenderingContext2D {
  const { map } = sprite.material;
  assert.ok(map instanceof THREE.CanvasTexture);

  const context = (map.image as HTMLCanvasElement).getContext(
    "2d"
  ) as unknown as MockCanvasRenderingContext2D | null;
  assert.ok(context, "canvas was not created through installCanvasMock");

  return context;
}
