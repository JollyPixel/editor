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
  deepActiveElement,
  themeStyles
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";

// Import Internal Dependencies
import type { TargetFrame } from "../tour/TargetSeek.ts";
import type { TourRun } from "../tour/TourRun.ts";
import {
  parseBody,
  type BodySpan
} from "../tour/parseBody.ts";
import type { TourStep } from "../tour/TourStep.ts";
import { lanternStyles } from "./LanternElement.styles.ts";
import {
  SpotlightPlacement,
  type SpotlightView,
  type TargetAnchor
} from "./spotlight/SpotlightPlacement.ts";
import { StepInput } from "./StepInput.ts";
import { TargetTracker } from "./TargetTracker.ts";

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

  #source = new SubscriptionController<TourRun>(
    this,
    (run) => {
      if (run.shown && run.state === "running") {
        void this.#show(run);
      }

      return [
        run.subscribe("step", () => void this.#show(run)),
        run.subscribe("end", () => this.#close()),
        () => this.#close()
      ];
    }
  );
  #tracker = new TargetTracker(this, (frame) => this.#place(frame));
  #theme = new AmbientThemeController(this);
  #input = new StepInput(this);
  #placed: SpotlightPlacement | null = null;
  #open = false;
  #restoreFocus: HTMLElement | null = null;

  get run(): TourRun | null {
    return this.#source.current;
  }

  set run(
    run: TourRun
  ) {
    if (run !== this.#source.current) {
      this.#source.attach(run);
    }
  }

  override render(): TemplateResult {
    const run = this.run;
    const step = this.#open && run !== null ? run.step : null;

    return html`
      <div class="overlay" popover="manual">
        ${step === null || run === null ? nothing : this.#renderStep(run, step)}
      </div>
    `;
  }

  #renderSpan(
    span: BodySpan
  ): TemplateResult | string {
    switch (span.kind) {
      case "kbd":
        return html`<kbd>${span.text}</kbd>`;
      case "unbound":
        return html`<kbd class="unbound">${span.text}</kbd>`;
      default:
        return span.text;
    }
  }

  #renderStep(
    run: TourRun,
    step: TourStep
  ): TemplateResult {
    const { title } = run.tour;
    const followUp = run.offeredFollowUp;

    return html`
      <div class="scrim"></div>
      <div class="shield" ?hidden=${run.waiting}></div>
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
          <span class="counter">${run.position} / ${run.count}</span>
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
          ${parseBody(step.body, run.keys).map((paragraph) => html`<p>${paragraph.map(
            (span) => this.#renderSpan(span)
          )}</p>`)}
        </div>
        <footer>
          <jolly-button class="skip" @click=${() => run.skip()}>Skip</jolly-button>
          <span class="spacer"></span>
          ${run.first ? nothing : html`
            <jolly-button class="back" @click=${() => void run.back()}>Back</jolly-button>
          `}
          <jolly-button
            class="next"
            variant=${followUp === null ? "accent" : "default"}
            ?disabled=${run.waiting}
            @click=${() => void run.next()}
          >${this.#nextLabel(run)}</jolly-button>
        </footer>
        ${followUp === null ? nothing : html`
          <jolly-button
            class="follow-up"
            variant="accent"
            @click=${() => void run.startFollowUp()}
          >Next tour: ${followUp.title}</jolly-button>
        `}
      </section>
    `;
  }

  async #show(
    run: TourRun
  ): Promise<void> {
    if (!this.#open) {
      this.#restoreFocus = deepActiveElement(this.ownerDocument);
      this.#open = true;
      this.#theme.follow();
    }
    this.#input.follow(run);
    this.requestUpdate();
    await this.updateComplete;
    if (
      run !== this.run ||
      run.state !== "running"
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
    if (!run.waiting && primary !== null) {
      await primary.updateComplete;
      primary.focus();
    }
    this.#tracker.track(run);
  }

  #close(): void {
    if (!this.#open) {
      return;
    }

    this.#open = false;
    this.#tracker.stop();
    this.#input.release();
    this.#placed = null;
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

  #place(
    frame: TargetFrame<TargetAnchor>
  ): void {
    const card = this._card;
    const scrim = this._scrim;
    const ring = this._ring;
    const run = this.run;
    if (
      card === null ||
      scrim === null ||
      ring === null ||
      run === null
    ) {
      return;
    }

    card.toggleAttribute("data-seeking", frame.kind === "seeking");
    if (frame.kind === "seeking") {
      return;
    }

    const root = this.ownerDocument.documentElement;
    const view: SpotlightView = {
      viewport: {
        width: root.clientWidth,
        height: root.clientHeight
      },
      card: {
        width: card.offsetWidth,
        height: card.offsetHeight
      },
      side: run.step.side
    };
    const placement = frame.kind === "anchored" ?
      SpotlightPlacement.around(frame.anchor, view) :
      SpotlightPlacement.centred(view);
    if (this.#placed?.equals(placement)) {
      return;
    }

    this.#placed = placement;
    placement.paint({
      scrim,
      ring,
      card
    });
    if (!this.hasAttribute("settled")) {
      requestAnimationFrame(
        () => this.toggleAttribute("settled", this.#open)
      );
    }
  }

  #nextLabel(
    run: TourRun
  ): string {
    if (run.waiting) {
      return "Waiting…";
    }

    return run.last ? "Done" : "Next";
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-lantern": LanternElement;
  }
}
