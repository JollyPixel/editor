# @jolly-pixel/ui specification

Foundation UI components for JollyPixel editors and demo examples.

Editors today (`editors/pixel-art`, `editors/voxel-map`, `editors/voxel-model`) and the Vite
examples (`voxel-renderer/examples`, `three/examples`) run on a mix of vanilla DOM, duplicated
Lit components and Tweakpane. This package replaces that mix with one themeable, event driven,
collaboration aware set of components.

Interfaces must stay reactive and must be able to show which player is editing what, and to
mark controls held by another player.

This document records the contracts and the reasoning. `PLAN.md` holds the implementation steps.

## 1. Architecture: two layers

Custom elements are the implementation and the public API. A builder facade constructs them.

```ts
// Layer 1: elements, used by editors
html`
  <jolly-folder label="Transform">
    <jolly-vector3
      .value=${transform.position}
      @jolly-change=${onMove}
    ></jolly-vector3>
  </jolly-folder>
`;

// Layer 2: builder facade, used by examples
const pane = new Pane({ title: "voxel.renderer" });
const folder = pane.addFolder({ title: "Transform" });
folder.addBinding(state, "position");
folder.addMonitor(state, "fps");
```

Editors write templates. Examples keep the Tweakpane shaped ergonomics they already use. One
implementation sits underneath both, so a fix lands once.

The facade is a thin constructor over elements. It owns no rendering.

## 2. State ownership: controlled elements, stateful facade

Elements never own their value. They render `value` and emit an intent event. The facade holds
the small store and performs the object write back.

```ts
// element: pure
<jolly-slider
  .value=${x}
  @jolly-input=${(event) => pipeline.setX(event.detail.value)}
></jolly-slider>

// facade: adds the write back
folder.addBinding(state, "x");
folder.refresh();
```

A remote peer's edit and a local edit follow the same path: intent, pipeline, new `value`,
re-render. There is no second code path and no "who wins" guard per control.

This mirrors `pixel-draw-renderer`, where UI calls intent methods on `EditPipeline` and the
view repaints from emitted change signals.

Consequence: no control mutates a bound object directly, and no control polls.

## 3. Field contract

Every control implements one shared contract. The four state-bearing members are in from the
start because they change what a value means, and retrofitting them touches every render path.

| Member | Type | Purpose |
|---|---|---|
| `label` | `string` | Row label |
| `description` | `string` | Inline help text below the control |
| `value` | `T \| typeof Mixed` | Current value, or `Mixed` across a multi selection |
| `default` | `T \| undefined` | Enables the revert affordance when `value` differs |
| `lockedBy` | `CollaboratorPresence \| null` | Peer currently holding the field |
| `error` | `string \| null` | Validation message |

```ts
export const Mixed = Symbol.for("jolly-pixel.ui.mixed") as unique symbol;

export type FieldValue<TValue> = TValue | typeof Mixed;

export function isMixed(value: unknown): value is typeof Mixed;
```

`Symbol.for` rather than `Symbol()` so identity survives a duplicate module instance. `ui` is a
workspace dependency resolved through `dist/` by three editors, which is the same hazard the
`lit` peer dependency guards against; with a unique symbol, `value === Mixed` would silently
return `false` across the boundary and a mixed field would render as an ordinary value.

The `as unique symbol` assertion is required: `Symbol.for()` is typed `symbol`, so without it
`FieldValue<string>` collapses to `string | symbol` and loses the distinctness.

`isMixed` is the narrowing helper every render path branches on. Nothing else ships here until a
control asks for it.

`Mixed` renders as a dash placeholder and leaves the value untouched until edited. Editing one
axis of a mixed `jolly-vector3` applies that axis to the whole selection and leaves the others
mixed.

`Mixed` also carries the collaborative display: a value that differs from a peer's uses the
same rendering path as a multi selection.

Numeric fields additionally support:

- Drag scrub on the label chip, continuous `jolly-input`, committing `jolly-change` on release
- Expression input (`1920/2` commits `960`), tokenizer plus shunting yard, never `eval`. A
  parse failure populates `error`

### Expression grammar

Deliberately small. Every additional feature is a token, a precedence row and a test, and each
one can be added later against a real request:

- Operators `+`, `-`, `*`, `/`, with unary `-` and `+`
- Parentheses
- Decimal and scientific number literals (`1.5`, `.5`, `1e3`)
- `,` accepted as a decimal separator alias, since no grammar rule uses a comma. Without it a
  French locale typing `1,5` gets a parse error in a numeric field

No functions, no constants, no variables, no units, no `%`, no `**`. That covers `1920/2`,
`100*1.5` and `(3+4)/2`, which is the shape of numeric field entry.

Evaluation returns a discriminated result rather than throwing. A malformed expression is
expected user input, not an exceptional condition; throwing would put a `try`/`catch` at every
numeric commit and make typos control flow by exception.

```ts
export type EvalResult =
  | { ok: true; value: number; }
  | { ok: false; error: string; };
```

`1/0` and any non-finite outcome return `{ ok: false }`, because a field cannot hold `Infinity`.
Input that already parses as a plain finite number short-circuits before the tokenizer, which is
roughly 95% of entries.

There is no denylist. A grammar-based parser rejects `alert(1)`, `constructor` and `a.b` for the
same reason it rejects any other unknown token, so the property to test is grammar closure, not
the blocking of particular strings.

## 4. Theming and design language

### Mechanism

Tokens are declared once, on a scope host, using `light-dark()`. Leaf components consume and
never declare.

```css
:host {
  color-scheme: light dark;
  --jolly-bg-surface: light-dark(#eef3f8, #131b24);
  --jolly-text: light-dark(#16232f, #e8eef5);
  --jolly-accent: light-dark(#2f6fd8, #3a6fc2);
}

:host([theme="light"]) { color-scheme: light; }
:host([theme="dark"]) { color-scheme: dark; }
```

The `theme` attribute only flips `color-scheme`. Adding a token is one line.

`editors/pixel-art/src/ui/theme.ts` declares its 13 tokens three times, once on `:host`, once
under `prefers-color-scheme`, once per `[theme]` value. That is the shape this replaces.

Custom properties inherit through shadow roots, so consumers override with plain CSS and no
piercing:

```css
jolly-pane { --jolly-accent: #ff6600; }
```

Leaf components read tokens with fallbacks (`var(--jolly-text, #16232f)`) so an element used
outside a scope host still renders.

Two panes on one page may carry different themes, which a document level stylesheet could not
support.

### Token tiers

Two tiers. Ramps are private and are never read by a component. Semantic aliases are the only
names components use, and the only names consumers override.

```css
/* tier 1: ramps, private */
--jolly-neutral-50 ... --jolly-neutral-900;
--jolly-accent-100 ... --jolly-accent-900;
--jolly-danger-*, --jolly-warning-*, --jolly-success-*;

/* tier 2: semantics, public, about 30 names */
--jolly-surface, --jolly-surface-sunken, --jolly-surface-raised;
--jolly-control-bg, --jolly-control-bg-hover, --jolly-control-bg-active;
--jolly-border, --jolly-border-strong;
--jolly-text, --jolly-text-muted, --jolly-text-on-fill;
--jolly-accent-fill, --jolly-accent-text;
--jolly-focus-ring, --jolly-locked, --jolly-modified;
```

Semantics reference ramps through `var()` rather than inlining their values:

```css
:host {
  --jolly-neutral-50:  oklch(97% 0.008 240);
  --jolly-neutral-900: oklch(21% 0.020 240);
  --jolly-surface: light-dark(var(--jolly-neutral-50), var(--jolly-neutral-900));
}
```

Light and dark differ by ramp index, not by hand picked pairs, so the two themes cannot drift
into disagreeing about which of two surfaces is darker. The indirection is what keeps that
invariant visible in the source — you read `50` against `900` on one line — and it surfaces in
devtools, where hovering `--jolly-surface` shows which ramp step it resolved to. Inlining the
values instead would make tier 1 decorative and put the pairs back in hand picked territory.

"Private" is a convention, not a mechanism. CSS has no privacy, so tier 1 is reachable by a
consumer who wants it; it is documented as unsupported rather than pretended to be inaccessible.

Thirteen flat tokens, as `pixel-art` has, does not stretch to 45 components with eight states.

### Palette

Ramps are authored in OKLCH so lightness steps are perceptually even.

The accent is seeded from `#4488ff`, the blue already used 24 times across voxel-map and
voxel-model, rather than pixel-art's `#2f6fd8` and `#3a6fc2` which appear 8 times.

`accent` is split, because it currently does two incompatible jobs with one value:

| Token | Job | Constraint |
|---|---|---|
| `--jolly-accent-fill` | Background behind text | White on it reaches 4.5:1 |
| `--jolly-accent-text` | Accent coloured text and icons | Reaches 4.5:1 on the surface |

Measured on the current values: `#3a6fc2` as text on `#131b24` is 3.5:1, below AA, while white
on `#3a6fc2` is 5.0:1. One token cannot satisfy both, which is why there are two.

Neutrals replace the seven unordered dark surfaces in use today (`#0e1316`, `#111a20`,
`#141a1d`, `#1a2228`, `#1e2a30`, `#2a3540`, `#2a3a4a`).

Axis colours are tokens, seeded from the existing `Vec3Input` values: X `#9b2020`, Y `#1e7a3a`,
Z `#1a4f80`.

Peer colours are generated by rotating hue on the golden angle at fixed lightness and chroma, so
any number of peers stay mutually distinguishable and equally legible:

```ts
export function peerColor(index: number): string {
  return `oklch(70% 0.15 ${(index * 137.5) % 360})`;
}
```

### Contrast

Committed targets, following WCAG 2.1:

| Pair | Ratio |
|---|---|
| Body and label text on its surface | 4.5:1 |
| Text 18px or larger | 3:1 |
| Borders, focus rings, control boundaries (1.4.11) | 3:1 |
| Peer colours against both surfaces | 3:1 |

These are design constraints, not assertions. Tokens are authored as CSS, so `light-dark()` and
the ramp `var()` chain only resolve in a browser — happy-dom has no cascade, and a `CSSResult` is
an opaque string a unit test can do nothing useful with. Checking every pair would mean either
duplicating the palette as TypeScript data purely to serve the tests, or thirty `getComputedStyle`
assertions in the end to end tier. Neither is worth it for a palette that changes rarely and
visibly, so the ratios above are verified when the ramps are authored and revisited when they
move.

### Density

Three presets on the scope host. They inherit, so a nested pane may override its parent.

| Preset | Row height | Font | Notes |
|---|---|---|---|
| `compact` | 18px | 11px | 20 uses in the codebase today |
| `default` | 22px | 12px | 24 uses, matches `padding: 2px 4px` plus a border |
| `comfortable` | 28px | 13px | 6 uses, dialogs and prose |

The three presets are the three font sizes already in use. Icon buttons and rails are a separate
role at 32px, following pixel-art's 36px rail button.

Verification cost is capped by exercising one representative gallery page per preset, not all
45 components.

### Spacing, radius, typography

Spacing is a 4px grid (`--jolly-space-1` through `-6`), replacing the current mix of 3, 4, 5, 6,
8, 10 and 15px gaps.

Radius collapses six values to two: `--jolly-radius-sm: 3px` (16 uses today) and
`--jolly-radius-md: 5px`.

Numeric values use `font-variant-numeric: tabular-nums`. Without it, digits change width while a
value is being scrubbed and the field jitters.

Labels use `--jolly-text-muted`, values use `--jolly-text`, which is the hierarchy the current
panels already apply by hand.

### Surfaces and elevation

In flow surfaces separate with a 1px border and a background step. Only genuinely floating
things carry a shadow, which is what makes them read as detached:

`--jolly-shadow-overlay` (menu, tooltip), `--jolly-shadow-floating` (floating pane),
`--jolly-shadow-modal` (dialog).

Controls carry no drop shadow. This keeps the `box-shadow` channel free for the lock ring below,
and avoids blurred shadows on 22px rows in a pane of sixty controls.

### State channels

Eight states, and several are active at once. Each owns a different channel so any combination
stays readable.

| State | Channel |
|---|---|
| Focus | Native `outline`, accent, `outline-offset: 2px`, outside the box |
| Locked | Inset ring, `box-shadow: inset 0 0 0 2px`, in the holder's peer colour |
| Error | Border colour, plus a message beneath |
| Modified | Revert affordance in the gutter |
| Mixed | Dash placeholder in the value area |
| Peers present | Stacked overlapping colour chips at the trailing edge |
| Hover, active | Background step (`--jolly-control-bg-hover`, `-active`) |
| Disabled | Reduced opacity, no pointer events |

Focus is outside and the lock is inside, so a locked field that is also focused shows both, and
focus is never suppressed. A single ring chosen by precedence would hide focus exactly when a
field is locked or invalid, failing WCAG 2.4.7.

Presence and locking are distinct. Several peers may hold focus on one field and all of them
render as chips; one is the resolved holder and colours the inset ring, while the rest are
`"contended"` per section 8 and are read only. Chips overflow to a `+N` counter.

### Motion

Two durations: `--jolly-duration-fast` at 100ms for hover and press, `--jolly-duration-base` at
160ms for expand, collapse and reveal. One easing token. This replaces the five ad hoc durations
in use.

Transitions always name their properties. `transition: all`, which appears once today, repaints
more than intended.

`prefers-reduced-motion: reduce` sets both durations to zero.

### Icons

16px grid, 1.5px stroke, `currentColor`, no fills, so an icon inherits the state colour of the
control containing it.

## 5. Component catalog

The boundary: `ui` owns anything expressible without knowing what a voxel, a layer or an asset
is. Domain coupled composites stay in editors and are built from these parts.

### Controls

`jolly-button`, `jolly-button-group` (segmented and grid), `jolly-checkbox`, `jolly-number`,
`jolly-slider`, `jolly-range` (min and max interval), `jolly-text`, `jolly-select`,
`jolly-flags` (bitmask), `jolly-color`, `jolly-separator`, `jolly-property-row`.

### Containers and chrome

`jolly-pane`, `jolly-folder`, `jolly-tabs`, `jolly-tab`, `jolly-dock`, `jolly-floating`,
`jolly-dialog`, `jolly-toolbar`, `jolly-rail`, `jolly-split`, `jolly-icon`.

### Data views

`jolly-tree` (drag and drop reparent, visibility and lock toggles), `jolly-list` (add, remove,
reorder, inline rename), `jolly-search`, `jolly-menu` (context menu), `jolly-toast`,
`jolly-progress`.

### Math

`jolly-vector2`, `jolly-vector3`, `jolly-vector4`, `jolly-quaternion` (edited as Euler angles),
`jolly-transform`, `jolly-point2d` (inline 2D pad).

### Monitors

`jolly-stats` (compact cycling HUD, see section 6), `jolly-monitor` (label and value row inside
a pane), `jolly-graph` (sparkline over a ring buffer).

### Collaboration

`jolly-presence` (avatar stack and connection state), plus `lockedBy` on every field.

### Out of scope

Asset and object reference pickers (need `fs-tree`), block and tileset libraries, 3D preview
tiles (need `three`), curve and gradient editors. Editors compose the first three from
`jolly-dialog`, `jolly-tree` and `jolly-list`.

### Evidence

Every entry above is either Tweakpane parity, a Godot or Unity inspector staple, or already
hand built more than once in this repository:

| Pattern | Hand built in | Copies |
|---|---|---|
| Collapsible section | `EditorSidebar`, `LayerPanel`, `MapConfigPanel`, `ObjectLayerPanel` | 4 |
| Property row | `MapConfigPanel`, `LayerPanel`, `ObjectLayerPanel`, `tabs/Build` | 4 |
| List with add, remove, rename | `ObjectLayerPanel`, `TilesetManager`, `LayerPanel` | 3 |
| Color input | pixel-art color rail, `tabs/Paint`, `tabs/Build` | 3 |
| Vector field | `Vec2Input`, `Vec3Input`, `tabs/Build` | 3 |
| Modal and prompt | `PromptDialog`, `PopupManager`, `AddMeshPopup` | 3 |
| Tab bar | `EditorSidebar`, voxel-model `LeftPanel` | 2 |
| Mode rail | pixel-art `ModeRail`, voxel-model `LeftPanel` | 2 |
| File import and export | `MapConfigPanel`, pixel-art `TextureDropController` | 2 |
| Tree with reparent | voxel-model `RightPanel` | 1, about 330 lines |
| Performance readout | runtime (stats.js), both `PerformancePanel` copies, voxel-map `PerformanceHUD` | 4 |
| Frame timing accumulator | both `PerformancePanel` copies, `PerformanceHUD` | 3 |

## 6. Stats and monitors

Four performance readouts exist today: stats.js in `runtime`, two duplicated `PerformancePanel`
files, and voxel-map's 297 line `PerformanceHUD`. The three Tweakpane ones render a graph plus
seven `label: value` rows, occupying roughly fifteen times the screen area of stats.js for the
same core information. This package keeps stats.js's footprint and drops the Tweakpane layout.

### Measurement is separate from display

`StatsRecorder` is a plain class. No DOM, no Lit, no element. It owns frame timing, the refresh
window and one ring buffer per metric.

```ts
const recorder = new StatsRecorder();

recorder.begin();
world.tick();
recorder.end();
```

`begin()` and `end()` keep stats.js's names so `Runtime.ts` call sites are unchanged.

The element subscribes and renders snapshots, so section 2 holds: the display owns no timer and
no state beyond its ring buffers, which are view state.

Being DOM free, the recorder is unit testable with a fake clock and usable headlessly, including
from `voxel-renderer/bench`.

### Metric interface

Built in metrics carry no privilege. They are registered through the same interface consumers
use, which is the only way to know the interface is sufficient.

```ts
export interface MetricDefinition {
  id: string;
  label: string;
  format?: (value: number) => string;
  /** Omit for auto scaling from the buffer contents. */
  min?: number;
  max?: number;
  /** Drives the graph colour ramp. */
  better?: "higher" | "lower";
  aggregate?: "last" | "average" | "max";
  /** Pulled once per refresh window, for values read from a live source. */
  sample?: () => number;
}
```

`ui` ships only what it can compute without domain knowledge: `fps`, `ms`, `worstMs`, and `mb`
where `performance.memory` exists. That is stats.js's three panels plus worst frame, which the
existing panels already track because an averaged framerate hides spikes.

Everything renderer or domain specific is contributed by the consumer, pulled or pushed:

```ts
// pulled, so the consumer owns no refresh cadence
recorder.addMetric({
  id: "calls",
  label: "draw calls",
  better: "lower",
  sample: () => renderer.info.render.calls
});

// pushed, when the value is already computed
recorder.track("buildMs", engine.debug.stats.buildTimeMs);
```

`performance.memory` is a non standard Chromium extension. The `mb` metric probes it
structurally and is not registered when absent, as the current panels already do.

Every registered metric is sampled every window, not only the visible one. Cycling to a metric
must show its history, not an empty graph. Ten pulls per quarter second is not a cost worth
optimising.

### Display

`jolly-stats` matches stats.js: one metric at a time in a tile of about 80 by 48 pixels, a large
numeric readout with the observed range, a bar graph beneath, and a click to advance to the next
metric.

```
58 FPS (12-60)
```

It does not expand and does not stack. A full readout of every metric at once is a pane of
`jolly-monitor` rows, which is what panes are for. Keeping the two separate is what stops this
component from drifting back into the layout it replaces.

Consequence, accepted deliberately: correlating two metrics visually is not possible, and a
consumer registering ten metrics creates a ten stop cycle.

Rendering is canvas based, as in stats.js. A DOM node per sample at sixty frames per second
thrashes layout. The tradeoff is that canvas cannot read custom properties, so theme tokens are
resolved through `getComputedStyle` on connect and re-resolved when `theme` or the colour scheme
changes.

The element is a plain inline block. The fixed position overlay is `jolly-floating` wrapping it,
per section 7, which retires the `.stats { position: fixed }` rule copied into three stylesheets.

Cycling is keyboard reachable: `role="button"`, `tabindex="0"`, Enter, Space and arrow keys. The
selected metric persists through the `StorageAdapter` of section 11.

### Replacing stats.js

`runtime` drops the `stats.js` dependency and imports the recorder only when
`includePerformanceStats` is set, so production game bundles carry nothing:

```ts
if (options.includePerformanceStats) {
  const { StatsRecorder } = await import("@jolly-pixel/ui/stats");
  this.stats = new StatsRecorder();
}
```

This also retires `stats.dom.removeAttribute("style")`, which exists only because stats.js
inlines styles that cannot otherwise be themed.

The `./stats` subpath is DOM free and exports the recorder alone, so importing it does not pull
Lit or any element.

## 7. Placement and chrome

Placement is separate from content. `jolly-pane` holds the content and fills its container.
Wrappers position it.

```html
<jolly-dock side="left" collapsable>
  <jolly-pane title="Layers">...</jolly-pane>
</jolly-dock>

<jolly-floating x="8" y="8">
  <jolly-pane title="voxel.renderer">...</jolly-pane>
</jolly-floating>

<jolly-pane title="Transform">...</jolly-pane>
```

Docked and floating share all content code. The facade defaults to wrapping in
`jolly-floating`, matching Tweakpane's default.

The docked wrapper is named `jolly-dock`, not `jolly-panel`, so no two tags differ by one
character.

### Resize

`@jolly-pixel/resize-handle` gains an optional `handle` option. When supplied, the handle is
used as is and no sibling element is injected.

```ts
export interface ResizeHandleOptions {
  direction: ResizeDirection;
  collapsable?: boolean;
  /**
   * Use this element as the handle instead of injecting a sibling.
   * Lets a shadow root own the handle while the host stays the resize target.
   */
  handle?: HTMLElement;
}
```

`jolly-dock` renders the handle in its shadow root, targets itself, and ships the styling. This
retires the `.resize-handle` block currently copied into three editors' `public/main.css`.

`html.handle-dragging` stays on `document.documentElement`, because suppressing pointer events
during a drag cannot work from inside a shadow root. The package injects that one rule once.

### Dialogs

`jolly-dialog` wraps the native `dialog` element and `showModal()`, which supplies the top
layer, focus trapping and Escape handling. `::backdrop` is styled inside the component's shadow
styles.

An imperative helper mirrors the existing `showPrompt()` in voxel-map:

```ts
const name = await showPrompt({ label: "Layer name" });
```

Built on `Promise.withResolvers`, removing the element on settle.

## 8. Collaboration

`ui` core depends on nothing network related. It declares a port and owns the presence schema,
because `PeerMetadata` in `@jolly-pixel/network` is an untyped `Record<string, unknown>`.

```ts
export interface CollaboratorPresence {
  clientId: string;
  displayName: string;
  color: string;
  /** Field path this peer currently holds. */
  editing?: string;
}

export type LockState = "held" | "denied" | "contended";

export interface PresenceSource {
  readonly peers: ReadonlyMap<string, CollaboratorPresence>;
  claim(path: string): LockState;
  release(path: string): void;
  on(event: "change", listener: () => void): void;
  off(event: "change", listener: () => void): void;
}
```

A `@jolly-pixel/ui/network` subpath ships the adapter mapping a `Room` onto this port. Importing
`@jolly-pixel/network` from its root entry pulls `Server.ts` and its `ws` dependency into a
browser bundle, so the adapter imports the `./client` subpath.

Examples with no room render normally against a null source.

### Lock semantics

Locks are advisory. Focusing a control publishes `editing: <path>` in that peer's presence.
Other clients render a colored ring and the holder's avatar, and the field becomes read only.

Two peers can claim at the same moment. Correctness comes from last write wins at the data
layer, not from the lock. The lock is a UX affordance.

Cleanup is free: the claim lives in the peer's presence, so it disappears with `peer-left`. A
server granted lease would need a TTL, heartbeat renewal and a reaper. `claim()` returns a
`LockState` so such a lease can replace the presence implementation without touching components.

### Accessibility

A locked field uses `aria-disabled` and read only input, never `inert`. It stays focusable, so
the value can be read and copied, and assistive technology announces the reason. `inert` would
hide a peer's edit from keyboard users entirely.

## 9. Input scope and shortcuts

A UI control and a running 3D viewport share one keyboard. Today they collide.

### The defect

`engine`'s `Keyboard` attaches to `document` and inspects no `event.target`, so every keystroke
reaches the engine no matter what has focus. Typing in a text field drives the camera.

It also calls `preventDefault()` on 33 control keys, `Tab`, `Escape`, `Delete`, `Home`, `End`
and the arrows among them. While the engine is connected, `Tab` cannot move focus between
controls, arrows and `Home` and `End` cannot move a caret, `Delete` is swallowed mid word, and
`Escape` is suppressed although `dialog` depends on it.

Those two combine into a deadlock. `setEnabled(false)` returns before `preventDefault`, so
gating from the UI does work, but only once focus is already inside the UI. With focus on the
canvas `Tab` is killed, so the keyboard can never reach the UI in the first place and a pointer
becomes mandatory.

The only mitigation in the repository is `editors/voxel-map/src/index.ts`, which yields the
keyboard while the pointer **hovers** the drawing canvas. Hover is not focus: moving the mouse
away mid sentence re-arms the engine under the user. It exists in one editor of three.

`setEnabled` already resets held keys so polling consumers see a release rather than a stuck
key, so the mechanism is sound. Only the policy is missing.

### Scope

Exactly one scope owns the keyboard at a time, and ownership follows focus, never hover.

```ts
export type InputScope = "viewport" | "ui";

export interface InputScopeSource {
  readonly scope: InputScope;
  on(event: "change", listener: (scope: InputScope) => void): void;
  off(event: "change", listener: (scope: InputScope) => void): void;
}
```

`ui` tracks `focusin` and `focusout` on its own roots and publishes the result. It takes no
dependency on `engine`, exactly as the presence port of section 8 takes none on `network`. The
editor wires the two together once:

```ts
uiScope.on("change", (scope) => {
  world.input.keyboard.setEnabled(scope === "viewport");
});
```

Focus detection must use `composedPath()` rather than `event.target`. Events crossing a shadow
boundary are retargeted to the host, so `document.activeElement` reports `jolly-pane` and not
the control actually focused inside it.

`InputScopeSource` and its focus tracker land in P6, in the same commit that replaces voxel-map's
hover based workaround. Building the port earlier would leave it unexercised across five phases,
so the first time it meets a real focus tree would be after forty five components exist. The
`engine` guard above is independent and lands in P0, since it is what makes the UI reachable by
keyboard at all.

### Engine side guard

Two changes in `engine`, independent of whether a consumer uses this package at all:

- Ignore key events whose target is editable, so a hand written `input` in an editor that never
  imports `@jolly-pixel/ui` is protected too
- Remove `Tab` and `Escape` from the prevented set, so focus can always leave the canvas and
  native `dialog` can close. Without the first, the deadlock survives every UI side fix

The guard is an exported `isEditableTarget(event)` in `Keyboard.class.ts`, not a `DocumentAdapter`
concern: the adapter exists for test injection, and putting policy there means every future
adapter reimplements it. As a standalone function it resolves through `composedPath()`, with a
`typeof event.composedPath === "function"` fallback to `event.target` for synthetic events.

It applies to two of the three handlers, and the asymmetry is load bearing:

| Handler | Guarded | Why |
|---|---|---|
| `keydown` | yes | The main defect. The key never enters `buttonsDown` |
| `keypress` | yes | Accumulates `newChar`. Typing in a field otherwise feeds the text straight to any consumer polling `keyboard.char` |
| `keyup` | **no** | Guarding it strands keys. Hold `W` on the canvas, `Tab` into a field, release: the guard swallows the `keyup`, `KeyW` stays in `buttonsDown`, and the camera drifts forever |

Guarding `keydown` but not `keyup` is correct for the bookkeeping, because deleting a key that
was never added is a harmless no-op.

`Escape` is removed rather than merely considered. Native `dialog`'s Escape-to-close is a browser
default action, so `preventDefault()` suppresses it: with `Escape` still prevented, `jolly-dialog`
closes in the examples gallery, where no engine is connected, and silently fails in every editor.
The editable-target guard does not help, because a dialog's focused close button is not editable.

Both removals are a behaviour change to a published package: a fullscreen canvas now loses focus
on `Tab`. The events still emit, so a consumer wanting the old behaviour has a one line opt-out,
which is what the changeset documents:

```ts
keyboard.on("Tab", (event) => event.preventDefault());
```

### Shortcuts

**Deferred, and unscheduled.** No phase in `PLAN.md` registers a binding through this registry:
P1 implements revert as a gutter affordance, not a shortcut, and no editor migration asks for
one. Section 16 still lists whether user rebindable shortcuts are wanted as an open point, so
building the registry, reservations and conflict reporting would mean shipping a subsystem for a
requirement that has not been made. The design below is recorded so it is ready when a consumer
does ask; until then nothing in `src/input/` implements it.

Ownership first, because the scope model is not a licence to move behaviour across the boundary.

`ui` never defines viewport bindings. Camera and movement controls belong to `runtime` and
`engine` and stay there. What `ui` provides is the registry mechanism, the bindings for its own
controls, and application level bindings an editor chooses to register.

```ts
// ui scope: fires only while a control has focus
registry.add({
  id: "field.revert",
  scope: "ui",
  match: "key",
  key: "z",
  ctrl: true,
  shift: true
});

// global: an editor level command, fires in both scopes
registry.add({
  id: "pane.toggle",
  scope: "global",
  match: "code",
  code: "F3"
});
```

Scopes are `viewport`, `ui` and `global`. Only `global` fires in both, which makes crossing the
boundary a deliberate, greppable choice rather than an accident.

Viewport bindings are not registered here. They may be **declared** as reservations, so the
registry can detect a collision without taking ownership of the behaviour:

```ts
// runtime still owns the binding; this only tells the registry it exists
registry.reserve("viewport", ["KeyW", "KeyA", "KeyS", "KeyD", "Space"]);
```

Matching is per binding because the two kinds want opposite things:

| Kind | Matches | Reason |
|---|---|---|
| Spatial (camera, movement, owned by runtime) | `event.code` | Physical position. `KeyW` is the key labelled Z on AZERTY, which is why ZQSD already works |
| Command (undo, copy, save) | `event.key` | The key the user sees printed. Matching `code: "KeyZ"` puts undo on the key labelled W on AZERTY |

`pixel-draw-renderer` currently matches its copy, paste and undo bindings on `event.code`, so
those sit on the wrong physical keys for any non QWERTY layout.

A central registry is what makes conflict detection possible at all. Registering a binding that
can fire in a scope overlapping another binding, or a reservation, warns in development with
both ids. That is the class of collision nothing can currently detect until a user hits it.

## 10. Math types

Structural, read only, no `three` dependency.

```ts
export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
```

`THREE.Vector3` satisfies this already, so 3D editors pass their objects directly while 2D
consumers of a button or a color swatch never pull a 3D library. Quaternion to Euler conversion
ships here, about 40 lines.

Values are immutable snapshots. Lit re-renders on assignment, so mutating in place does not
repaint:

```ts
// no repaint
mesh.position.set(1, 2, 3);

// repaints
mesh.position = mesh.position.clone().set(1, 2, 3);
```

Properties declare `hasChanged` with a component wise comparison so re-assigning an equal valued
object does not repaint.

## 11. Persistence

Reorder order and pane state persist through a pluggable adapter.

```ts
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}
```

Default implementation wraps `localStorage` and falls back to memory when it throws. That happens
in two places, at different times, and both are handled:

- **At construction**, reading the `window.localStorage` property itself throws in a sandboxed
  iframe. Probed once inside `try`/`catch`; on failure the instance is memory backed for life
- **At write**, `setItem` throws `QuotaExceededError` long after construction succeeded. Every
  `set` is wrapped, and a first write failure degrades that instance to memory permanently rather
  than throwing into a render

Both paths are unit testable by injecting a throwing stub.

### Keys

An explicit `key` wins. Otherwise the key derives from tag name plus a slug of the label, with
declaration order breaking ties:

```html
<jolly-folder label="Transform">   <!-- jolly-folder:transform -->
<jolly-vector3 label="Transform">  <!-- jolly-vector3:transform -->
<jolly-folder label="Options">     <!-- jolly-folder:options -->
<jolly-folder label="Options">     <!-- jolly-folder:options#2 -->
```

Derivation is pure, so it is unit testable without a DOM. Tag name, label and occurrence index
are all read by the caller; the pane owns the occurrence counter:

```ts
deriveKey(tagName: string, label: string, occurrence: number): string;
```

The slug normalises rather than stripping. A naive non-alphanumeric strip turns
`"Rotation générale"` into `rotation-g-n-rale`, and gives `"Échelle"` and `"Echelle"` different
keys for what a user reads as one label. So: NFD normalise, drop combining marks, lowercase,
collapse runs of non-alphanumerics to a single `-`, trim leading and trailing `-`. An empty or
all punctuation label falls back to the tag name and occurrence alone.

Configuring a key per component was rejected as too heavy. The costs, all recoverable by setting
`key` explicitly, and a development only warning fires on a tie:

- Renaming a label drops that item's saved position
- Swapping a control's type does the same
- Occurrence suffixes renumber. Two `Options` folders give `…:options` and `…:options#2`; delete
  the **first** and the survivor becomes `…:options`, inheriting the deleted item's saved
  position while its own entry is dropped as orphaned. "I removed an unrelated folder and another
  one moved" is a confusing symptom, so it is recorded here rather than discovered later

The pane namespace derives from `location.pathname` plus the pane title, so editors sharing
`localhost` in development do not overwrite each other. `storage-key` overrides it.

Reconciliation on load, stated as an algorithm because "take their declared position" is
ambiguous once a list has been reordered — declared position among all present keys, and position
relative to stored neighbours, differ whenever a control is inserted mid list:

1. Keep stored order for keys still present; drop stored keys that are gone
2. Insert each present but unstored key immediately after its nearest preceding declared sibling
   that survived step 1, or at the front if there is none

So adding a control in the middle of the source puts it in the middle of a user reordered pane,
and the whole function is testable with two arrays of strings.

## 12. Naming and events

- Elements are prefixed `jolly-`, matching the existing `jolly-popup-manager`
- Events are prefixed `jolly-`, `bubbles: true`, `composed: true`
- `jolly-input` fires continuously during interaction, `jolly-change` on commit
- `jolly-reorder` and `jolly-revert` carry the affected keys
- Every element declares its tag in `HTMLElementTagNameMap`

## 13. Testing

Two tiers.

Unit tests target logic that needs little or no DOM mocking, run under `node:test` with `c8`.
Geometry lives in pure functions so it is testable with plain numbers:

```ts
deriveKey(tagName, label, occurrence);
resolveOrder(stored, present);
clampToViewport(x, y, rect, viewport);
valueFromDelta({ start, deltaPx, step, pixelsPerStep, multiplier, min, max });
evaluate("1920/2");
```

`valueFromDelta` takes an object because it needs seven inputs and ESLint caps `max-params` at
five. The four beyond `(start, deltaPx, step)` are not optional in practice: `pixelsPerStep`,
without which a 0.01 step field is unusably twitchy; `min` and `max`, since a scrub leaving the
field's range is the same defect as an unclamped resize; and `multiplier`, so the component maps
shift and control onto fine and coarse while the function stays pure.

Size-from-delta is deliberately absent. `resize-handle` already computes it inline, and
`jolly-dock` delegates resizing to that package, so a copy here would be duplication in the
package that exists to remove duplication. It is extracted and clamped there instead.

End to end tests run with Playwright against the examples gallery, following the pattern in
`editors/pixel-art`: `testMatch: "**/*.e2e.ts"` so the two runners never collect each other's
files, a `webServer` booting the Vite dev server, and workers isolated from one another.

happy-dom has no layout engine and no CSS cascade, so resize geometry, floating placement, drag
and drop hit testing and `light-dark()` resolution belong to the end to end tier.

Note for any test that does import Lit: Lit resolves to its Node export condition, and
`@lit/reactive-element/node/css-tag.js` reads `Document.prototype` at import time. A setup file
must register `Document`, `ShadowRoot`, `CSSStyleSheet` and `HTMLTemplateElement`, which the
existing `pixel-draw-renderer` setup does not.

### Examples gallery

One page. A `jolly-dock` on the left lists the examples, the right side swaps content. The
gallery is built from this package's own components, so browsing it is also the standing proof
that the components compose.

Examples declare themselves. The left list is derived from the manifest rather than maintained
by hand, so adding a file adds a navigation entry:

```ts
export interface GalleryExample {
  id: string;
  title: string;
  group: string;
  /** Returns its own teardown, so swapping examples leaks nothing. */
  render(host: HTMLElement): (() => void) | void;
}
```

Two kinds, because "one goal" means different things for a control and for a behaviour:

- **Component examples** render one component through a shared state matrix helper: default,
  mixed, locked, error, modified, disabled, each tagged `[data-state]`. All of them stay
  identical, and adding a seventh state updates every component example at once
- **Scenario examples** cover one behaviour with whatever setup it needs, which no component
  example can provide: input scope with a live viewport, locking with two peers, reorder
  persistence across a reload, the three densities, stats cycling under a frame loop

### Addressing examples from tests

The gallery is chrome that tests must be able to opt out of. Built from `jolly-dock` and
`jolly-list`, the shell otherwise shares fate with every test in the suite: a regression in
either would turn the whole report red and say nothing about which component broke.

Extending the query parameter approach already used by `editors/pixel-art`:

| URL | Renders |
|---|---|
| `/` | Full gallery, first example selected |
| `/?example=controls/slider` | Full gallery, deep linked |
| `/?example=controls/slider&chrome=off` | The example alone, no dock, no list |

One mechanism, not two. An earlier draft also offered hash routing (`/#/controls/slider`) for the
same job, which buys history handling, a precedence rule for when both forms are present, and two
code paths to test. The query parameter is what tests use, what `chrome=off` composes with, and
what `editors/pixel-art` already does with `?empty`.

Tests use the last form and gate on a `window.__galleryReady` flag, mirroring
`__pixelSyncReady`. The shell keeps a small suite of its own so it stays covered: the list
renders every manifest entry, selecting an entry swaps content, a deep link selects the right
entry, and the dock's width survives a reload.

Enumerating the manifest gives one cheap test with disproportionate value: every example mounts
and disposes without throwing. That catches the "component throws on connect" class across the
whole library in a single loop.

## 14. Package boundaries

| Dependency | Kind | Reason |
|---|---|---|
| `lit` | peer `^3.3.0` plus pinned dev | Two copies would break class identity and re-register tags |
| `@jolly-pixel/resize-handle` | runtime, added in P2 | `jolly-dock` |
| `@jolly-pixel/network` | none in core | Adapter only, under `./network`, importing `./client` |
| `three` | none | Structural math types instead |

Subpath exports:

| Subpath | Contents | Pulls Lit | Declared in |
|---|---|---|---|
| `.` | Elements and facade | yes | P0 |
| `./stats` | `StatsRecorder` and metric types, DOM free | no | P3b |
| `./network` | `RoomPresenceSource`, importing `@jolly-pixel/network/client` | yes | P7 |

Each subpath is declared in the phase that creates its code, never earlier. `exports` targets are
not validated at build time, so an entry pointing at a path `tsc` never emits publishes a map
whose subpath throws `ERR_MODULE_NOT_FOUND` on import, with nothing in the build to catch it.

`./stats` exists so `runtime` can take the recorder without taking an element library. `runtime`
imports it dynamically, behind `includePerformanceStats`, so game bundles pay nothing when the
flag is off.

The workspace currently resolves a single hoisted `lit@3.3.3`, while `runtime` requests `^3.3.1`.
That range is pinned as part of P0. Because `.npmrc` sets `package-lock=false`, there is no
lockfile to hold that tree in place, so a single copy is not something the repository can
guarantee — only something it can check. `npm ls lit` returning one deduped entry is therefore
part of P0's completion criteria rather than a claim in a risk table.

Note that `save-exact=true` means npm will not write the `^3.3.0` peer range itself; it is hand
edited.

## 15. Rejected alternatives

| Rejected | Reason |
|---|---|
| Imperative builder only, a Tweakpane clone | Editors would rewrite working Lit templates as builder calls |
| Elements only, no facade | Examples would keep Tweakpane, and the duplication goal fails |
| Self mutating elements | Remote edits fight the user mid drag, needing per control guards |
| Optimistic apply with rollback | A pending and confirmed state machine per control, unjustified before a real multiplayer editor exists |
| Depending on `@jolly-pixel/network` from core | Root entry drags server code into browser bundles |
| Server granted lock leases | Needs a protocol, heartbeats and a reaper in `network`, and would block this package |
| Tokens on every component's `:host` | Overriding one token means targeting every tag, and nested elements shadow the override |
| A single flat tier of tokens | Thirteen names do not stretch to 45 components with eight states, and light and dark drift apart |
| A third tier of per component tokens | About 180 public names to document and keep stable, for a library maintained by a small team |
| Seeding the accent from pixel-art's blue | It would shift a blue used four times more often across voxel-map and voxel-model |
| Hand authored hex ramps | Perceptual spacing drifts between steps, and every peer colour needs hand checking |
| One accent token for fill and text | Measured: 3.5:1 as text but 5.0:1 as a fill under white, so one value cannot serve both |
| A global em based scale factor | Fractional scales blur 1px borders and 22px rows, and canvas has to re-read the size |
| A single ring chosen by precedence | Focus disappears exactly when a field is locked or invalid, failing WCAG 2.4.7 |
| Trailing badges for every state | Three badges plus gaps consume about 48px of value width at `compact` |
| Elevation led surfaces | Blurred shadows on 22px rows read as blur, cost paint across sixty controls, and compete with the inset lock ring |
| No shadows at all | A menu opening over a pane of the same colour is separated by a hairline alone |
| Gating the engine keyboard on hover | Moving the pointer away mid sentence re-arms the engine under the user, as voxel-map does today |
| Fixing input scope in `ui` alone | `Tab` stays prevented while the viewport has focus, so the keyboard can never reach the UI |
| Fixing input scope in `engine` alone | A focused rail button or tree node is not editable, so keys still reach the viewport |
| `ui` owning viewport bindings | Camera and movement are `runtime` and `engine` responsibilities; `ui` supplies the registry, not the behaviour |
| Matching every binding on `event.code` | Undo lands on the key labelled W on AZERTY, which is what `pixel-draw-renderer` does today |
| Matching every binding on `event.key` | Movement stops being a physical cluster and needs a remap table per layout |
| A global `:root` stylesheet | One theme per document, and an element renders unstyled without the import |
| One component with a `placement` attribute | One class owning docking, dragging, resizing and content, the shape that hit the max lines ceiling in `PixelArtCanvas.ts` |
| Reordering by declaration index | Inserting one control scrambles every saved position after it |
| Auto keys from the label alone | Duplicate labels collide silently |
| Depending on `three` for math types | A 2D color swatch would transitively pull a 3D engine |
| Real browser for the whole suite | The tier that already times out spuriously in pixel-art, and `c8` wiring gets harder |
| Tweakpane style monitor rows for the HUD | A graph plus seven rows costs about fifteen times stats.js's area for the same information |
| An expandable or stacked stats HUD | Rejected in favour of strict stats.js parity, accepting that two metrics cannot be compared side by side |
| `begin()` and `end()` on the element | Timing state inside a Lit element cannot be tested without a DOM and cannot be reused by `bench/` |
| Push only metrics | Every consumer re-implements the refresh window accumulator, already duplicated three times |
| Privileged built in metrics | Built ins registered through the public interface are the only proof that it suffices |
| Sampling only the visible metric | Cycling would reveal an empty graph |
| DOM or SVG per sample | Layout thrash at sixty frames per second, which is why stats.js uses canvas |
| Keeping stats.js in `runtime` | Its inline styles are already fought with `removeAttribute("style")` and cannot be themed |
| Authoring tokens as TypeScript data that generates the CSS | Duplicates the palette in a second form purely so a unit test can assert contrast, for a palette that changes rarely and visibly |
| Unit testing every contrast pair | `light-dark()` and the ramp `var()` chain resolve only in a browser; a `CSSResult` is an opaque string |
| `Symbol("mixed")` for the mixed sentinel | Identity breaks silently across a duplicate module instance, and `ui` is resolved through `dist/` by three editors |
| Hash routing alongside the query parameter | Two mechanisms for one job: history handling, a precedence rule, and two code paths to test |
| Throwing from `evaluate` | A malformed expression is expected user input; throwing puts a `try`/`catch` at every numeric commit |
| Denylisting `eval` shaped input | A grammar rejects unknown tokens inherently; a denylist invites the belief that the grammar is permissive |
| `ui` owning size-from-delta | `resize-handle` already computes it and is what actually runs; a second copy is the duplication this package exists to remove |
| Guarding `keyup` alongside `keydown` | Strands held keys when focus moves to a field mid press, and the camera drifts forever |
| Building the shortcut registry in P0 | No phase registers a binding, and section 16 still questions whether rebindable shortcuts are wanted |
| Building `InputScopeSource` in P0 | Its consumer is P6; it would sit unexercised until after forty five components exist |

## 16. Open points

- Whether `jolly-tree` virtualizes. Deferred until a consumer exceeds a few hundred nodes
- Whether pane state beyond order persists through Tweakpane style `exportState` and
  `importState`, decided in P3 when the facade lands
- Whether user rebindable shortcuts are needed, and if so where the overrides persist. The
  registry makes it possible; nothing currently asks for it
