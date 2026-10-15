// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  query
} from "lit/decorators.js";
import {
  AmbientThemeController,
  SubscriptionController,
  anchoredPosition,
  deepActiveElement,
  inputLayers,
  originatesInButton,
  themeStyles,
  type AnchorRect,
  type ViewportSize
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { LanternSession } from "../session/LanternSession.ts";
import { parseBody } from "../tour/parseBody.ts";
import type { TourStep } from "../tour/TourStep.ts";
import { lanternStyles } from "./LanternElement.styles.ts";
import {
  borderRadius,
  holeAround,
  holeAtCentre,
  spotlightPath,
  type Hole
} from "./spotlight.ts";
import { stepKeyAction } from "./stepKeys.ts";
import {
  TargetTracker,
  type TargetFrame
} from "./TargetTracker.ts";

// CONSTANTS
const kHolePadding = 6;
const kCardGap = 10;

@customElement("jolly-lantern")
export class LanternElement extends LitElement {
  static override styles = [
    themeStyles,
    lanternStyles
  ];

  @query(".overlay")
  declare _overlay: HTMLElement | null;

  @query(".scrim")
  declare _scrim: HTMLElement | null;

  @query(".ring")
  declare _ring: HTMLElement | null;

  @query(".card")
  declare _card: HTMLElement | null;

  @query(".next")
  declare _next: HTMLElementTagNameMap["jolly-button"] | null;

  @query(".follow-up")
  declare _followUp: HTMLElementTagNameMap["jolly-button"] | null;

  #source = new SubscriptionController<LanternSession>(
    this,
    (session) => [
      session.subscribe("step", () => void this.#show(session)),
      session.subscribe("end", () => this.#close()),
      () => this.#close()
    ]
  );
  #tracker = new TargetTracker(this, (frame) => this.#place(frame));
  #theme = new AmbientThemeController(this);
  #open = false;
  #layout = "";
  #restoreFocus: HTMLElement | null = null;
  #input: AbortController | null = null;

  get session(): LanternSession | null {
    return this.#source.current;
  }

  set session(
    session: LanternSession
  ) {
    if (session !== this.#source.current) {
      this.#source.attach(session);
    }
  }

  override render(): TemplateResult {
    const session = this.session;
    const step = this.#open && session !== null ? session.step : null;

    return html`
      <div class="overlay" popover="manual">
        ${step === null || session === null ? nothing : this.#renderStep(session, step)}
      </div>
    `;
  }

  #renderStep(
    session: LanternSession,
    step: TourStep
  ): TemplateResult {
    const { steps, title } = session.tour;
    const followUp = session.offeredFollowUp;

    return html`
      <div class="scrim"></div>
      <div class="shield" ?hidden=${session.waiting}></div>
      <div class="ring" hidden></div>
      <section
        class="card"
        role="dialog"
        aria-labelledby="title"
        aria-describedby="body"
        data-seeking
      >
        <header>
          <span>${title}</span>
          <span class="counter">${session.index + 1} / ${steps.length}</span>
        </header>
        ${step.image === null ? nothing : html`
          <img
            src=${step.image.src}
            alt=${step.image.alt}
            width=${step.image.width ?? nothing}
            height=${step.image.height ?? nothing}
          >
        `}
        <h2 id="title">${step.title}</h2>
        <div id="body" class="body">
          ${parseBody(step.body).map((paragraph) => html`<p>${paragraph.map(
            (span) => (span.kind === "kbd" ? html`<kbd>${span.text}</kbd>` : span.text)
          )}</p>`)}
        </div>
        <footer>
          <jolly-button class="skip" @click=${() => session.skip()}>Skip</jolly-button>
          <span class="spacer"></span>
          ${session.first ? nothing : html`
            <jolly-button class="back" @click=${() => void session.back()}>Back</jolly-button>
          `}
          <jolly-button
            class="next"
            variant=${followUp === null ? "accent" : "default"}
            ?disabled=${session.waiting}
            @click=${() => void session.next()}
          >${nextLabel(session)}</jolly-button>
        </footer>
        ${followUp === null ? nothing : html`
          <jolly-button
            class="follow-up"
            variant="accent"
            @click=${() => void session.startFollowUp()}
          >Next tour: ${followUp.title}</jolly-button>
        `}
      </section>
    `;
  }

  async #show(
    session: LanternSession
  ): Promise<void> {
    if (!this.#open) {
      this.#restoreFocus = deepActiveElement(this.ownerDocument);
      this.#open = true;
      this.#theme.follow();
    }
    this.#syncInput(session);
    this.#layout = "";
    this.requestUpdate();
    await this.updateComplete;
    if (
      session !== this.session ||
      session.state !== "running"
    ) {
      return;
    }

    const overlay = this._overlay;
    if (
      overlay !== null &&
      !overlay.matches(":popover-open")
    ) {
      overlay.showPopover();
    }

    const primary = this._followUp ?? this._next;
    if (!session.waiting && primary !== null) {
      await primary.updateComplete;
      primary.focus();
    }
    this.#tracker.track(session);
  }

  #close(): void {
    if (!this.#open) {
      return;
    }

    this.#open = false;
    this.#tracker.stop();
    this.#releaseInput();
    this.#theme.stop();
    this.removeAttribute("settled");
    const overlay = this._overlay;
    if (overlay?.matches(":popover-open")) {
      overlay.hidePopover();
    }
    this.requestUpdate();

    const restore = this.#restoreFocus;
    this.#restoreFocus = null;
    if (restore?.isConnected) {
      restore.focus();
    }
  }

  #syncInput(
    session: LanternSession
  ): void {
    if (session.waiting) {
      this.#releaseInput();

      return;
    }
    if (this.#input !== null) {
      return;
    }

    const input = new AbortController();
    const releaseLayer = inputLayers.push({
      dismiss: () => {
        session.skip();

        return true;
      }
    });
    input.signal.addEventListener("abort", releaseLayer, { once: true });
    this.#input = input;
    const since = performance.now();
    this.ownerDocument.defaultView?.addEventListener("keydown", (event) => {
      const action = stepKeyAction(event);
      if (
        action === null ||
        event.timeStamp < since ||
        (event.key === "Enter" && originatesInButton(event.composedPath()[0]))
      ) {
        return;
      }

      event.preventDefault();
      if (action === "skip") {
        session.skip();
      }
      else {
        void session[action]();
      }
    }, { signal: input.signal });
  }

  #releaseInput(): void {
    this.#input?.abort();
    this.#input = null;
  }

  #place(
    frame: TargetFrame
  ): void {
    const card = this._card;
    const scrim = this._scrim;
    const ring = this._ring;
    const session = this.session;
    if (
      card === null ||
      scrim === null ||
      ring === null ||
      session === null
    ) {
      return;
    }

    const root = this.ownerDocument.documentElement;
    const viewport: ViewportSize = {
      width: root.clientWidth,
      height: root.clientHeight
    };
    const panel = {
      width: card.offsetWidth,
      height: card.offsetHeight
    };
    const anchor = frame.kind === "anchored" ? frame : null;
    const rect = anchor?.rect ?? null;
    const layout = JSON.stringify([
      frame.kind,
      rect?.top,
      rect?.left,
      rect?.bottom,
      rect?.right,
      anchor?.radii,
      viewport,
      panel
    ]);
    if (layout === this.#layout) {
      return;
    }
    this.#layout = layout;

    card.toggleAttribute("data-seeking", frame.kind === "seeking");
    if (frame.kind === "seeking") {
      return;
    }

    const hole = anchor === null ?
      holeAtCentre(viewport) :
      holeAround(anchor.rect, anchor.radii, viewport, kHolePadding);
    const position = anchor === null ?
      {
        x: (viewport.width - panel.width) / 2,
        y: (viewport.height - panel.height) / 2
      } :
      anchoredPosition({
        anchor: anchorAround(hole),
        panel,
        viewport,
        gap: kCardGap,
        side: session.step.side,
        align: "center"
      });

    scrim.style.clipPath = spotlightPath(hole, viewport);
    ring.hidden = anchor === null;
    ring.style.transform = `translate(${hole.x}px, ${hole.y}px)`;
    ring.style.width = `${hole.width}px`;
    ring.style.height = `${hole.height}px`;
    ring.style.borderRadius = borderRadius(hole.radii);
    card.style.transform = `translate(${position.x}px, ${position.y}px)`;

    if (!this.hasAttribute("settled")) {
      requestAnimationFrame(
        () => this.toggleAttribute("settled", this.#open)
      );
    }
  }
}

function nextLabel(
  session: LanternSession
): string {
  if (session.waiting) {
    return "Waiting…";
  }

  return session.last ? "Done" : "Next";
}

function anchorAround(
  hole: Hole
): AnchorRect {
  return {
    top: hole.y,
    left: hole.x,
    bottom: hole.y + hole.height,
    right: hole.x + hole.width
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-lantern": LanternElement;
  }
}
