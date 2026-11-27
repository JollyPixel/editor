// Import Third-party Dependencies
import type {
  LaunchMessage,
  ShellMessage
} from "@jolly-pixel/editor.host";

export interface EditorFrameOptions {
  id: string;
  element: HTMLIFrameElement;
  reads: ReadonlySet<string>;
  origin: string;
}

type LaunchHints = Pick<LaunchMessage, "reveal" | "tag">;

export class EditorFrame {
  readonly id: string;
  readonly element: HTMLIFrameElement;
  readonly reads: ReadonlySet<string>;

  #origin: string;
  #stops: Array<() => void> | null = null;
  #unsent: LaunchHints = {};

  constructor(
    options: EditorFrameOptions
  ) {
    this.id = options.id;
    this.element = options.element;
    this.reads = options.reads;
    this.#origin = options.origin;
  }

  accepts(
    event: MessageEvent
  ): boolean {
    return event.source !== null &&
      event.source === this.element.contentWindow &&
      event.origin === this.#origin;
  }

  launch(
    message: Omit<LaunchMessage, keyof LaunchHints>,
    stops: Array<() => void>
  ): void {
    this.#stops = stops;
    const hints = this.#unsent;
    this.#unsent = {};
    this.#send(
      {
        ...message,
        ...hints
      },
      Object.values(message.ports).filter((port) => port !== undefined)
    );
  }

  reveal(
    key: string
  ): void {
    this.#direct({ reveal: key }, {
      type: "jolly-reveal",
      key
    });
  }

  view(
    tag: string
  ): void {
    this.#direct({ tag }, {
      type: "jolly-view",
      tag
    });
  }

  post(
    message: ShellMessage
  ): void {
    this.#send(message, []);
  }

  closePorts(): void {
    for (const stop of this.#stops ?? []) {
      stop();
    }
    this.#stops = null;
  }

  dispose(): void {
    this.closePorts();
    this.element.remove();
  }

  #direct(
    hint: LaunchHints,
    message: ShellMessage
  ): void {
    if (this.#stops === null) {
      this.#unsent = {
        ...this.#unsent,
        ...hint
      };
    }
    else {
      this.post(message);
    }
  }

  #send(
    message: ShellMessage | LaunchMessage,
    transfer: Transferable[]
  ): void {
    this.element.contentWindow?.postMessage(message, this.#origin, transfer);
  }
}
