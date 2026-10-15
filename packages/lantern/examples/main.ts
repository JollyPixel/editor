// Import Third-party Dependencies
import {
  LocalStorageAdapter
} from "@jolly-pixel/ui";
import {
  Lantern,
  Tour
} from "@jolly-pixel/lantern";
import "@jolly-pixel/lantern/element";

// Import Internal Dependencies
import lanternUrl from "./lantern.svg";

class DemoToolbar extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { display: flex; gap: 8px; padding: 8px 16px; }
      </style>
      <jolly-button>Open</jolly-button>
      <jolly-button data-tour="save">Save</jolly-button>
    `;
  }
}
customElements.define("demo-toolbar", DemoToolbar);

const lanternElement = document.querySelector("jolly-lantern")!;
const viewport = document.querySelector<HTMLElement>("#viewport")!;
const clicks = document.querySelector("#clicks")!;
const pane = document.querySelector<HTMLElement>("#pane")!;
const dock = document.querySelector("jolly-pane-group")!;

let clickCount = 0;
viewport.addEventListener("click", () => {
  clickCount++;
  clicks.textContent = String(clickCount);
});

const lantern = new Lantern({
  storage: new LocalStorageAdapter(),
  present: (session) => {
    lanternElement.session = session;
  }
});

const more = new Tour({
  id: "example.more",
  version: 1,
  title: "More tours",
  steps: [
    {
      id: "chained",
      title: "Chained tour",
      body: "The previous tour offered this one on its last step."
    }
  ]
});

const basics = new Tour({
  id: "example.basics",
  version: 1,
  title: "Lantern example",
  followUp: more,
  steps: [
    {
      id: "welcome",
      title: "Welcome",
      body: "This page shows every kind of step.\n\nUse `→` and `←` to move, `Esc` to leave.",
      image: {
        src: lanternUrl,
        alt: "A lantern glowing in the dark",
        width: 320,
        height: 120
      }
    },
    {
      id: "save",
      target: ["demo-toolbar", "[data-tour=save]"],
      title: "Save",
      body: "This button lives inside the toolbar's shadow root."
    },
    {
      id: "pane",
      target: ["#pane"],
      side: "right",
      title: "Blocks",
      body: "The pane is highlighted while this step shows.",
      enter: () => {
        pane.toggleAttribute("data-highlighted", true);

        return () => pane.removeAttribute("data-highlighted");
      }
    },
    {
      id: "docked",
      target: ["jolly-pane[key=layers]"],
      side: "left",
      title: "Docked pane",
      body: "A pane against the screen edge is outlined exactly, its tab included.",
      enter: () => {
        dock.active = "layers";
      }
    },
    {
      id: "edge",
      target: ["#edge"],
      side: "right",
      title: "Near the edge",
      body: "The card asked for the right side and flipped to fit."
    },
    {
      id: "click",
      target: ["#viewport"],
      side: "above",
      title: "Click the viewport",
      body: "The tour goes on once you click inside the outlined area.",
      until: ({ signal }) => new Promise((resolve) => {
        viewport.addEventListener("click", () => resolve(), {
          once: true,
          signal
        });
      })
    },
    {
      id: "missing",
      target: ["#missing"],
      title: "Missing target",
      body: "No element matches this step, so the card is centred."
    }
  ]
});

lantern.register(basics);
lantern.register(more);
document.querySelector("#start")!.addEventListener("click", () => {
  lantern.start(basics);
});
