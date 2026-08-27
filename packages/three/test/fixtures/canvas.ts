// happy-dom provides real <canvas> elements (DOM tree, sizing, style) but no
// 2D rendering context, so installCanvasMock patches getContext("2d") to
// return a no-op-drawing stub. PeerFrustum's label only needs the context to
// not throw — pixel output isn't asserted on.
export class MockCanvasRenderingContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern = "#000000";
  strokeStyle: string | CanvasGradient | CanvasPattern = "#000000";
  lineWidth = 1;
  font = "";
  textAlign: CanvasTextAlign = "left";
  textBaseline: CanvasTextBaseline = "alphabetic";

  fillTextCallCount = 0;
  lastFillText = "";
  strokeTextCallCount = 0;
  lastStrokeText = "";
  roundRectCallCount = 0;
  lineJoin: CanvasLineJoin = "miter";

  clearRect(..._args: unknown[]): void {
    // No-op for testing
  }
  fillRect(..._args: unknown[]): void {
    // No-op for testing
  }
  strokeRect(..._args: unknown[]): void {
    // No-op for testing
  }
  beginPath(): void {
    // No-op for testing
  }
  closePath(): void {
    // No-op for testing
  }
  roundRect(..._args: unknown[]): void {
    this.roundRectCallCount++;
  }
  fill(): void {
    // No-op for testing
  }
  stroke(): void {
    // No-op for testing
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
    this.strokeTextCallCount++;
    this.lastStrokeText = text;
  }

  measureText(
    text: string
  ): TextMetrics {
    return { width: text.length * 8 } as TextMetrics;
  }
}

/**
 * Patches doc.createElement so a "canvas" gets a working mock 2D context
 * (happy-dom's own getContext returns null). The element stays happy-dom's,
 * keeping real events, sizing, and DOM-tree behavior.
 */
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

/**
 * Returns the mock 2D context patched onto a canvas by installCanvasMock,
 * exposing call counters for assertions.
 */
export function mockContextOf(
  canvas: HTMLCanvasElement
): MockCanvasRenderingContext2D {
  const context = canvas.getContext(
    "2d"
  ) as unknown as MockCanvasRenderingContext2D | null;
  if (context === null) {
    throw new Error(
      "canvas was not created through installCanvasMock"
    );
  }

  return context;
}
