// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  svg,
  type SVGTemplateResult,
  type TemplateResult
} from "lit";
import {
  FrameUpdateController,
  SubscriptionController,
  readDetail,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import { clamp } from "@jolly-pixel/utils";
import "@jolly-pixel/ui/elements/message";
import "@jolly-pixel/ui/elements/select";

// Import Internal Dependencies
import type { SoundCollaboration } from "../../collaboration/SoundCollaboration.ts";
import type { SoundPlayer } from "../../player/SoundPlayer.ts";
import type { LiveSettings } from "../../settings/LiveSettings.ts";
import type { DistanceFalloff } from "../../player/spatial/DistanceFalloff.ts";
import type { PlanePoint } from "../../player/spatial/PlanePoint.ts";
import type {
  SourceMotion,
  SourcePlacement
} from "../../player/spatial/SourcePlacement.ts";
import { PadScale } from "./PadScale.ts";
import { spatialPadStyles } from "./SpatialPad.styles.ts";

interface RingDrag {
  readonly scale: PadScale;
  refDistance: number;
}

interface FalloffRing {
  distance: number;
  label: string;
  full: boolean;
}

// CONSTANTS
const kMargin = 1.15;
const kHeatStops = 16;
const kHeatOpacity = 0.45;
const kCurveSamples = 64;
const kPathSamples = 48;
const kKeyStep = 0.05;
const kRingSpacing = 0.06;
const kMinLabelRadius = 0.15;
const kLevelRings = [-12, -24].map((decibels) => {
  return {
    gain: 10 ** (decibels / 20),
    label: formatDecibels(decibels)
  };
});
const kArrows: Record<string, PlanePoint> = {
  ArrowUp: {
    x: 0,
    z: -1
  },
  ArrowDown: {
    x: 0,
    z: 1
  },
  ArrowLeft: {
    x: -1,
    z: 0
  },
  ArrowRight: {
    x: 1,
    z: 0
  }
};
const kMotions: JollyOption<SourceMotion>[] = [
  {
    value: "still",
    label: "Still"
  },
  {
    value: "orbit",
    label: "Orbit"
  },
  {
    value: "flyby",
    label: "Fly-by"
  },
  {
    value: "approach",
    label: "Approach"
  }
];
const kMotionHint = "Motion over each pass of the sound: Orbit circles " +
  "around you, Fly-by passes through the dot from left to right, Approach " +
  "walks in to the dot";
const kPadLabel = "Sound position around you, seen from above. Drag it or " +
  "move it with the arrow keys";
const kRingHint = "Drag to change the Ref distance: full volume inside " +
  "this ring";
const kHeadphonesHint = "Use headphones: left and right only come through " +
  "on headphones.";

export class SpatialPad extends LitElement {
  #player = new SubscriptionController<SoundPlayer>(this, (player) => [
    player.subscribe("change", () => this.requestUpdate()),
    player.subscribe("settings", () => this.requestUpdate())
  ]);
  #collaboration = new SubscriptionController<SoundCollaboration>(
    this,
    () => []
  );
  #settings = new SubscriptionController<LiveSettings>(this, () => []);
  #frames = new FrameUpdateController(this);
  #ringDrag: RingDrag | null = null;

  #onPointerDown = (
    event: PointerEvent
  ): void => {
    const pad = event.currentTarget;
    const player = this.#player.current;
    if (event.button !== 0 || !(pad instanceof Element) || player === null) {
      return;
    }

    pad.setPointerCapture(event.pointerId);
    if (
      this.#settings.current?.editable === true &&
      event.target instanceof Element &&
      event.target.classList.contains("ring-grab")
    ) {
      this.#ringDrag = {
        scale: this.#scale(player.spatial.falloff()),
        refDistance: player.settings.spatial.refDistance
      };
    }
    this.#dragTo(pad, event);
  };

  #onPointerMove = (
    event: PointerEvent
  ): void => {
    const pad = event.currentTarget;
    if (pad instanceof Element && pad.hasPointerCapture(event.pointerId)) {
      this.#dragTo(pad, event);
    }
  };

  #onDragEnd = (): void => {
    const drag = this.#ringDrag;
    if (drag !== null) {
      this.#ringDrag = null;
      this.#settings.current?.commit({
        spatial: { refDistance: drag.refDistance }
      });
    }
  };

  #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const direction = kArrows[event.key];
    const player = this.#player.current;
    if (direction === undefined || player === null) {
      return;
    }

    event.preventDefault();
    const { placement } = player.mode;
    const scale = this.#scale(player.spatial.falloff());
    const radius = scale.radius(placement.distance());
    const step = scale.distance(radius + kKeyStep) - scale.distance(radius);
    this.#place(placement.movedTo({
      x: placement.x + direction.x * step,
      z: placement.z + direction.z * step
    }));
  };

  #onMotion = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<SourceMotion>>(event);
    const player = this.#player.current;
    if (detail !== null && player !== null) {
      this.#place(player.mode.placement.withMotion(detail.value));
    }
  };

  static override styles = spatialPadStyles;

  attach(
    player: SoundPlayer,
    collaboration: SoundCollaboration,
    settings: LiveSettings
  ): void {
    this.#player.attach(player);
    this.#collaboration.attach(collaboration);
    this.#settings.attach(settings);
  }

  protected override updated(): void {
    if (this.#player.current?.spatial.moving === true) {
      this.#frames.schedule();
    }
  }

  override render(): TemplateResult | typeof nothing {
    const player = this.#player.current;
    if (player === null || this.#collaboration.current === null) {
      return nothing;
    }

    const { placement } = player.mode;
    const falloff = player.spatial.falloff();
    const scale = this.#scale(falloff);
    const point = player.spatial.sourcePoint() ?? placement;
    const source = scale.toPad(point);
    const distance = Math.hypot(point.x, point.z);

    return html`
      <div class="body">
        <jolly-select
          label="Motion"
          title=${kMotionHint}
          data-tool="motion"
          .options=${kMotions}
          .value=${placement.motion}
          @jolly-change=${this.#onMotion}
        ></jolly-select>
        <svg
          class="pad"
          viewBox="-1 -1 2 2"
          tabindex="0"
          role="application"
          aria-label=${kPadLabel}
          @pointerdown=${this.#onPointerDown}
          @pointermove=${this.#onPointerMove}
          @lostpointercapture=${this.#onDragEnd}
          @keydown=${this.#onKeyDown}
        >
          <defs>
            <radialGradient id="heat" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse">
              ${this.#heatStops(scale, falloff)}
            </radialGradient>
          </defs>
          <circle r="1" fill="url(#heat)"></circle>
          <text class="ring-label" x="0.97" y="0.96" text-anchor="end">${scale.extent}</text>
          ${this.#rings(scale, falloff)}
          ${this.#path(scale, placement, falloff.reach())}
          <circle class="listener" r="0.045"></circle>
          <path class="listener" d="M-0.022 -0.04 0 -0.075 0.022 -0.04z"></path>
          <circle
            class="source"
            cx=${source.x}
            cy=${source.z}
            r="0.035"
          ></circle>
        </svg>
        <div class="readout">
          <span>Distance ${formatDistance(distance)}</span>
          <span>${formatGain(falloff.gain(distance))}</span>
        </div>
        ${this.#curve(scale, falloff, distance)}
        <jolly-message role="note">${kHeadphonesHint}</jolly-message>
      </div>
    `;
  }

  #dragTo(
    pad: Element,
    event: PointerEvent
  ): void {
    const player = this.#player.current;
    const settings = this.#settings.current;
    if (player === null || settings === null) {
      return;
    }

    const bounds = pad.getBoundingClientRect();
    const across = (event.clientX - bounds.left) / bounds.width;
    const down = (event.clientY - bounds.top) / bounds.height;
    const point = this.#scale(player.spatial.falloff()).toWorld({
      x: clamp(across * 2 - 1, -1, 1),
      z: clamp(down * 2 - 1, -1, 1)
    });
    const drag = this.#ringDrag;
    if (drag === null) {
      this.#place(player.mode.placement.movedTo(point));

      return;
    }

    drag.refDistance = Math.round(Math.hypot(point.x, point.z) * 10) / 10;
    settings.preview({
      spatial: { refDistance: drag.refDistance }
    });
  }

  #scale(
    falloff: DistanceFalloff
  ): PadScale {
    return this.#ringDrag?.scale ??
      PadScale.covering(falloff.reach() * kMargin);
  }

  #place(
    placement: SourcePlacement
  ): void {
    const player = this.#player.current;
    const collaboration = this.#collaboration.current;
    if (player !== null && collaboration !== null) {
      collaboration.retune(player.mode.withPlacement(placement));
    }
  }

  #heatStops(
    scale: PadScale,
    falloff: DistanceFalloff
  ): SVGTemplateResult[] {
    return Array.from({ length: kHeatStops + 1 }, (_, index) => {
      const offset = index / kHeatStops;
      const opacity = falloff.gain(scale.distance(offset)) * kHeatOpacity;

      return svg`
        <stop class="heat-stop" offset=${offset} stop-opacity=${opacity}></stop>
      `;
    });
  }

  #rings(
    scale: PadScale,
    falloff: DistanceFalloff
  ): SVGTemplateResult[] {
    return falloffRings(falloff)
      .filter(({ distance }) => distance > 0 && distance <= scale.extent)
      .map(({ distance, label, full }) => {
        const radius = scale.radius(distance);
        const corner = radius * Math.SQRT1_2;

        return svg`
          <circle class=${full ? "ring full" : "ring"} r=${radius}></circle>
          ${full ? svg`
            <circle class="ring-grab" r=${radius}>
              <title>${kRingHint}</title>
            </circle>
            <circle class="ring-handle" cx=${radius} r="0.025"></circle>
          ` : nothing}
          ${radius < kMinLabelRadius ? nothing : svg`
            <text class="ring-label" x=${corner + 0.02} y=${-corner - 0.02}>${label}</text>
          `}
        `;
      });
  }

  #path(
    scale: PadScale,
    placement: SourcePlacement,
    reach: number
  ): SVGTemplateResult | typeof nothing {
    if (placement.motion === "still") {
      return nothing;
    }

    const points = Array.from({ length: kPathSamples }, (_, index) => {
      const point = scale.toPad(
        placement.pointAt(index / (kPathSamples - 1), reach)
      );

      return `${point.x},${point.z}`;
    });

    return svg`<polyline class="path" points=${points.join(" ")}></polyline>`;
  }

  #curve(
    scale: PadScale,
    falloff: DistanceFalloff,
    distance: number
  ): TemplateResult {
    const points = Array.from({ length: kCurveSamples }, (_, index) => {
      const along = index / (kCurveSamples - 1);

      return `${along},${1 - falloff.gain(scale.distance(along))}`;
    });
    const marker = Math.min(scale.radius(distance), 1);

    return html`
      <svg
        class="curve"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        role="img"
        aria-label="Volume over distance"
      >
        <polyline class="curve-line" points=${points.join(" ")}></polyline>
        <line class="curve-marker" x1=${marker} x2=${marker} y1="0" y2="1"></line>
      </svg>
    `;
  }
}

function falloffRings(
  falloff: DistanceFalloff
): FalloffRing[] {
  const reach = falloff.reach();
  const rings: FalloffRing[] = [
    {
      distance: falloff.distanceAt(1),
      label: "Full",
      full: true
    },
    {
      distance: falloff.fadeEnd(),
      label: "Max",
      full: false
    },
    ...kLevelRings.map(({ gain, label }) => {
      return {
        distance: falloff.distanceAt(gain),
        label,
        full: false
      };
    })
  ];

  return rings.filter(({ distance }, index) => rings
    .slice(0, index)
    .every((ring) => Math.abs(ring.distance - distance) > reach * kRingSpacing)
  );
}

function formatDistance(
  distance: number
): string {
  return distance.toFixed(distance < 10 ? 2 : 1);
}

function formatGain(
  gain: number
): string {
  return gain <= 0 ? "Silent" : formatDecibels(20 * Math.log10(gain));
}

function formatDecibels(
  decibels: number
): string {
  const rounded = Math.round(decibels * 10) / 10;
  const text = Number.isInteger(rounded) ?
    String(rounded) :
    rounded.toFixed(1);

  return `${text.replace("-", "−")} dB`;
}

customElements.define("jolly-sound-spatial", SpatialPad);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-sound-spatial": SpatialPad;
  }
}
