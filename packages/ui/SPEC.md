# @jolly-pixel/ui specification

Foundation UI components for JollyPixel editors and demo examples.

Editors and Vite examples currently mix vanilla DOM, duplicated Lit components and Tweakpane.
This package replaces them with themeable, event-driven, collaboration-aware components.
`PLAN.md` describes delivery.

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

Editors use templates; examples keep Tweakpane-like ergonomics. The facade is a thin element
constructor with no rendering of its own.

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

Local and remote edits share one path: intent, pipeline, new `value`, re-render. Controls never
mutate bound objects or poll; this mirrors `pixel-draw-renderer`'s `EditPipeline` model.

### Value and draft

`value` is consumer owned. An element may keep transient `draft` state for partial text,
expressions, drag origins and incomplete colours; it is discarded on commit, Escape, or a fresh
value while unfocused.

```ts
// consumer owned, replaced from outside
value: FieldValue<T>;

// element owned, discarded on commit, Escape or a fresh value while unfocused
#draft: string | null;
#parseError: string | null;
```

While focused, a draft wins over incoming `value` so remote edits do not rewrite text under the
caret. Other row state keeps updating. Enter and blur commit; Escape discards. `jolly-text`
emits `jolly-input` per keystroke, while `jolly-number` does so only when scrubbing. Consumers
must write a `jolly-change` value back, or the next render restores the old value.

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
| `peers` | `CollaboratorPresence[]` | Peers focused on the field, rendered as chips |
| `disabled` | `boolean` | Not operable, not focusable |
| `readonly` | `boolean` | Not editable, still focusable and copyable |
| `error` | `string \| null` | Validation message, consumer owned |
| `align` | `"start" \| "end"` | Which edge the value sits against |
| `labelPosition` | `"inline" \| "top"` | `"top"` puts the label on its own line above the value |

`peers` represents everyone focused on the field; `lockedBy` is the resolved holder. `error` is
consumer owned. Parse failures use private `#parseError`, which takes display precedence without
overwriting consumer validation.

`labelPosition` reflects as `label-position` because the property is two words; every other
reflected member above is one. Rows with `"top"` still hold gutter, value and trailing to the
contract's usual shapes, just split across two lines instead of one, so a container that sets
`--jolly-gutter-width` for lock icons keeps both lines flush at the same left edge. `jolly-transform`
forwards it to `position`, `rotation` and `scale`, which is the case dense numeric rows most want
the extra vertical room.

`disabled`, `readonly`, and `lockedBy` combine rather than override:

```ts
protected get editable(): boolean {
  return !this.disabled && !this.readonly && this.lockedBy === null;
}
```

They map to different accessibility semantics, because they mean different things:

| Property | Inner input | ARIA | Focusable |
|---|---|---|---|
| `disabled` | `disabled` | native | no |
| `readonly` | `readonly` | `aria-readonly="true"` | yes |
| `lockedBy` | `readonly` | `aria-disabled="true"` plus the holder named | yes |

Derived `locked`, `mixed`, `modified`, and `invalid` reflect to the host, as do `disabled` and
`readonly`. No `path` ships until P7 provides a claimant.

```ts
export const Mixed = Symbol.for("jolly-pixel.ui.mixed") as unique symbol;

export type FieldValue<TValue> = TValue | typeof Mixed;

export function isMixed(value: unknown): value is typeof Mixed;
```

`Symbol.for` preserves identity across duplicate module instances; `as unique symbol` preserves
the distinct type. `isMixed` is the render-path narrowing helper.

`Mixed` renders as a dash placeholder and leaves the value untouched until edited. Editing one
axis of a mixed `jolly-vector3` applies that axis to the whole selection and leaves the others
mixed.

Values differing from a peer use the same mixed rendering. Mixed values disable gestures that
need a starting value, but typing remains available.

| Control | Mixed display | An edit commits |
|---|---|---|
| `jolly-number` | dash, no scrub cursor | the typed value |
| `jolly-slider` | track, no thumb, no drag | the clicked position |
| `jolly-range` | track, no thumbs | nothing until typed |
| `jolly-text` | dash placeholder | the typed value |
| `jolly-checkbox` | native `indeterminate` | `true` |
| `jolly-select` | no option selected | the picked option |
| `jolly-button-group` | nothing pressed | the pressed option |
| `jolly-flags` | dash, no bits lit | the whole typed mask |
| `jolly-color` | dash, no swatch | the picked colour |

Numeric fields support:

- Drag scrub from a left handle: continuous `jolly-input`, `jolly-change` on release, a dashed
  pointer guideline, `Shift` ×10 and `Alt` ×0.1. `Ctrl` is unused because macOS treats Ctrl-drag
  as right click
- `ArrowUp`/`ArrowDown` stepping through `valueFromDelta`, with the same modifiers and a discrete
  `jolly-change`
- Expression input such as `1920/2`, evaluated by tokenizer and shunting yard, never `eval`;
  failures populate `#parseError`

### Expression grammar

The grammar stays deliberately small:

- Operators `+`, `-`, `*`, `/`, with unary `-` and `+`
- Parentheses
- Decimal and scientific number literals (`1.5`, `.5`, `1e3`)
- `,` accepted as a decimal separator alias, since no grammar rule uses a comma. Without it a
  French locale typing `1,5` gets a parse error in a numeric field

It has no functions, constants, variables, units, `%`, or `**`. Evaluation returns a
discriminated result rather than throwing.

```ts
export type EvalResult =
  | { ok: true; value: number; }
  | { ok: false; error: string; };
```

`1/0` and other non-finite results fail. Plain finite numbers bypass tokenisation. Grammar
closure rejects unknown input such as `alert(1)`, `constructor`, and `a.b`; no denylist exists.

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

The `theme` attribute only flips `color-scheme`; each token has one declaration. This replaces
pixel-art's three declarations of each of its 13 tokens.

Custom properties inherit through shadow roots, so consumers override with plain CSS and no
piercing:

```css
jolly-pane { --jolly-accent: #ff6600; }
```

A leaf must not declare inherited tokens on `:host`. It would block consumer overrides, and it
also breaks theming outright: declaring the token block re-declares `color-scheme: light dark`,
which resets the scheme inherited from the scope host, so a nested element drops back to the
system preference while everything around it stays on the chosen theme. Only scope hosts apply
`themeStyles`; `jolly-dialog` is the one component that does, because it renders in the top layer.

Fallbacks stay at use sites and only cover `text`, `control-bg`, `border-strong`, and
`focus-ring`, defined once in `src/theme/fallbacks.ts`; wider fallbacks would duplicate the
palette and cannot preserve `light-dark()`. A component warns once per tag when
`--jolly-surface` is absent. Scoped hosts allow multiple themes on one page.

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
--jolly-ink, --jolly-ink-danger;
--jolly-control-bg, --jolly-control-bg-hover, --jolly-control-bg-focus,
--jolly-control-bg-active, --jolly-control-bg-muted;
--jolly-invalid-bg, --jolly-invalid-bg-hover, --jolly-invalid-bg-focus;
--jolly-row-bg-focus, --jolly-groove, --jolly-divider;
--jolly-border, --jolly-border-strong;
--jolly-text, --jolly-text-muted, --jolly-text-on-fill;
--jolly-accent-fill, --jolly-accent-fill-hover, --jolly-accent-fill-focus, --jolly-accent-text;
--jolly-focus-ring, --jolly-locked, --jolly-modified;
```

Control backgrounds are not ramp steps. They are one ink at alpha stops, composited over
whatever plane the control lands on:

```css
--jolly-ink: light-dark(var(--jolly-neutral-900), var(--jolly-neutral-50));
--jolly-control-bg: color-mix(in oklab, var(--jolly-ink) 8%, transparent);
--jolly-control-bg-hover: color-mix(in oklab, var(--jolly-ink) 12%, transparent);
--jolly-control-bg-focus: color-mix(in oklab, var(--jolly-ink) 20%, transparent);
--jolly-control-bg-active: color-mix(in oklab, var(--jolly-ink) 26%, transparent);
```

One decision instead of six, and a control stays coherent at any nesting depth without each
level picking its own opaque pair. **Containers paint opaque or paint nothing; only leaves
tint.** Two translucent layers over each other drift lighter, which is the invariant that
prevents it. `--jolly-invalid-*` is the same mechanism with `--jolly-ink-danger` substituted,
starting above the hover stop so an error never reads as "the pointer is here".

Semantics reference ramps through `var()` rather than inlining their values:

```css
:host {
  --jolly-neutral-50:  oklch(97% 0.008 240);
  --jolly-neutral-900: oklch(21% 0.020 240);
  --jolly-surface: light-dark(var(--jolly-neutral-50), var(--jolly-neutral-900));
}
```

Light and dark select ramp indices rather than hand-picked pairs. Ramp privacy is conventional:
consumers can read them, but only semantic aliases are supported. A flat 13-token palette cannot
cover 45 components and eight states.

### Palette

Ramps are authored in OKLCH so lightness steps are perceptually even.

The accent is seeded from `#4488ff`, used 24 times across voxel-map and voxel-model, rather than
pixel-art's two blues, used eight times.

`accent` is split, because it currently does two incompatible jobs with one value:

| Token | Job | Constraint |
|---|---|---|
| `--jolly-accent-fill` | Background behind text | White on it reaches 4.5:1 |
| `--jolly-accent-text` | Accent coloured text and icons | Reaches 4.5:1 on the surface |

`#3a6fc2` is 3.5:1 as text on `#131b24`, but 5.0:1 beneath white; one token cannot satisfy both.

Neutrals replace seven unordered dark surfaces currently in use.

Axis colours are tokens, seeded from the existing `Vec3Input` values: X `#9b2020`, Y `#1e7a3a`,
Z `#1a4f80`.

Peer colours are generated by rotating hue on the golden angle at fixed lightness and chroma, so
any number of peers stay mutually distinguishable and equally legible:

```ts
export function peerColor(index: number): string {
  return `oklch(60% 0.16 ${(index * 137.5) % 360})`;
}
```

60% lightness reaches 3.45:1 on light and 4.12:1 on dark surfaces; 70% reaches only 2.36:1 on
light.

### Contrast

Committed targets, following WCAG 2.1:

| Pair | Ratio |
|---|---|
| Body and label text on its surface | 4.5:1 |
| Text 18px or larger | 3:1 |
| Peer colours against both surfaces | 3:1 |

**Non-text contrast (1.4.11) is deliberately not met for control boundaries.** Controls carry no
border. A control is separated from its surface by an 8% ink fill, roughly 1.1:1, and hover,
focus and active are further alpha stops on that same fill. This is a chosen trade: the borderless,
fill-differentiated look is the design goal, and a boundary that clears 3:1 by fill alone forces
surfaces heavy enough to lose it. The consequence is real and should be stated plainly to anyone
auditing an editor built on this package: control boundaries and keyboard focus will be flagged.

Two mitigations keep the result operable rather than merely quiet:

- `@media (forced-colors: active)` drops the ink system for system colours, so Windows High
  Contrast users get real boundaries back
- focus is layered, not single channel: the control's own fill steps to 20% and the containing
  row tints at 5%, so the active row is locatable in a long pane even where the control's step is
  subtle

`--jolly-border-strong` survives as a token for consumers who want outlines back, but nothing in
the package paints with it. `--jolly-divider` replaces `--jolly-border` for the few remaining
group-level rules (dialog header and footer), and is deliberately faint: a divider at 3:1 reads as
a hard rule between every row of a sixty control pane.

These are design constraints, checked when ramps are authored or changed. CSS cascade resolution
makes unit assertions unhelpful, and duplicating the palette solely for tests is not warranted.

### Density

Three presets on the scope host. They inherit, so a nested pane may override its parent.

| Preset | Row height | Font | Pitch with the row gap |
|---|---|---|---|
| `compact` | 16px | 10px | 20px |
| `default` | 20px | 11px | 24px |
| `comfortable` | 26px | 12px | 30px |

Each preset lost the 1px control border it used to include, so `default` is 20px rather than 22px:
the old figure was derived as `padding: 2px 4px` plus a border that no longer exists.

Rows own no outer spacing. The container stacking them applies `--jolly-row-gap`, so leaves
compose flush when a consumer wants them to, and a container can set its own rhythm. Icon buttons
and rails remain a separate 32px role. One representative gallery page verifies each preset.

### Spacing, radius, typography

Spacing is a 4px grid (`--jolly-space-1` through `-6`), replacing the current mix of 3, 4, 5, 6,
8, 10 and 15px gaps.

Radius collapses six values to two, chosen far enough apart that they read as different roles
rather than as two similar numbers: `--jolly-radius-sm: 2px` for controls, `--jolly-radius-md: 6px`
for planes.

Typography is monospace throughout, at 11px. The package embeds Roboto Mono (weight 400, latin
subset, Apache-2.0) as a base64 `data:` URI in `src/theme/font.ts`, because the package builds
with bare `tsc` and has no asset pipeline that could rewrite a `.woff2` URL for a consumer's
bundler. It costs roughly 16KB inlined. `@font-face` is ignored inside a shadow root, so
`ensureFontFace()` registers it against the document; importing `themeStyles` calls it, and
without it the family falls back to the system mono stack.

One weight only. A second would roughly double those bytes, so hierarchy is expressed through
tint and letter-spacing rather than through a bolder face that would otherwise be synthesised.

Numeric values use `font-variant-numeric: tabular-nums`. Without it, digits change width while a
value is being scrubbed and the field jitters.

Labels use `--jolly-text-muted`, values use `--jolly-text`, which is the hierarchy the current
panels already apply by hand.

### Surfaces and elevation

Containers split by role, because the package has two kinds and they want opposite treatment.

**Planes** paint an opaque surface and own the elevation story. `jolly-dock` and `jolly-rail`
are in flow; `jolly-dialog` and `jolly-floating` are detached and are the only two that carry a
shadow, which is what makes them read as detached at all.

**In-pane containers** paint nothing. `jolly-folder` and `jolly-tabs` are transparent and inherit
whichever plane they land on, so nesting stays coherent without any level re-picking colours.
`jolly-pane` is the one hybrid: it paints `--jolly-surface` so a standalone pane is still a plane,
and `jolly-dock` and `jolly-floating` null that out through `::slotted` when they contain one.

Separation between containers comes from the tint on leaves plus `--jolly-row-gap`, not from
rules. Only dialog headers and footers keep a `--jolly-divider` line, because a dialog genuinely
has group structure to express.

| Token | Used by |
|---|---|
| `--jolly-shadow-overlay` | menu, tooltip |
| `--jolly-shadow-floating` | `jolly-floating` |
| `--jolly-shadow-modal` | `jolly-dialog` |

A docked pane carries no shadow. Controls carry none either, which keeps `box-shadow` free for
the lock and modified bars and avoids blur on a 20px row.

### State channels

Eight states, and several are active at once. Each owns a different channel so any combination
stays readable.

| State | Channel |
|---|---|
| Focus | Fill step on the control (`--jolly-control-bg-focus`), plus a fainter tint on the row |
| Locked | Leading 3px bar and a faint background tint on the field, in the holder's peer colour |
| Error | The control's ink re-tinted to `--jolly-ink-danger`, plus a message beneath |
| Modified | Leading 2px bar in `--jolly-modified`, with the revert action at the trailing edge |
| Mixed | Dash placeholder in the value area |
| Peers present | Stacked overlapping colour chips at the trailing edge |
| Hover, active | Fill step (`--jolly-control-bg-hover`, `-active`) |
| Disabled | Reduced opacity, no pointer events |

There is no focus ring. Focus, hover, active and error all express through the one fill channel,
which is why their stops are ordered rather than merely different: rest 8%, hover 12%, focus 20%,
active 26%, and error starting at 15% so it cannot be mistaken for hover.

`jolly-color` and `jolly-flags` render a tinted box around the native input. `jolly-checkbox` and
`jolly-slider` opt out of the surrounding fill so their compact native control and track remain
visually distinct from text fields.

Locked and modified both want the leading bar, so locked takes it: a locked field is not editable,
which makes reverting moot. The revert action remains visible in the muted text colour whenever
the value differs from its default. Its full-height gutter joins the value edge, and its hover fill
matches the adjacent control background.

Peers render as chips, one resolved holder colours the lock, and excess chips collapse to `+N`.

`--jolly-gutter-width` is `0` by default, so a single user pane pays no leading inset. A
collaborative container opts its subtree in at 14px, which buys the fixed inset that stops a lock
from shifting the row. A lock present without that opt-in still renders, widening the row rather
than clipping.

### Motion

Two durations: `--jolly-duration-fast` at 100ms for hover and press, `--jolly-duration-base` at
160ms for expand, collapse and reveal. One easing token. This replaces the five ad hoc durations
in use.

Transitions always name their properties. `transition: all`, which appears once today, repaints
more than intended.

`prefers-reduced-motion: reduce` sets both durations to zero.

### Icons

Icons render at 16px, at an effective 1.5px stroke, in `currentColor` with no fills, so an icon
inherits the state colour of the control containing it.

The authoring grid is a 24 viewBox at `stroke-width: 2.25`, which is the same icon: a 24 viewBox
drawn into 16px scales by two thirds, and `2.25 * 2 / 3` is exactly 1.5. That matters because
`editors/pixel-art` already carries 27 hand authored glyphs on a 24 viewBox at 2.2 to 2.4, so P8
moves them verbatim instead of redrawing them for no visible difference.

The registry is open, and built in glyphs carry no privilege: they are registered through the
same `registerIcon` a consumer calls. This is the rule section 6 states for metrics, for the same
reason, and it is what lets `voxel-map` put a domain glyph on a `JollyOption` without `ui` taking
ownership of a cube.

```ts
export type IconName = BuiltinIconName | (string & {});

export type IconGlyph = string | SVGTemplateResult;

export function registerIcon(name: string, glyph: IconGlyph): void;
```

The `(string & {})` union keeps autocomplete on the built in names while accepting any other.

## 5. Component catalog

The boundary: `ui` owns anything expressible without knowing what a voxel, a layer or an asset
is. Domain coupled composites stay in editors and are built from these parts.

### Controls

`jolly-button`, `jolly-button-group` (segmented and grid), `jolly-checkbox`, `jolly-number`,
`jolly-slider`, `jolly-range` (min and max interval), `jolly-text`, `jolly-select`,
`jolly-flags` (bitmask), `jolly-color`, `jolly-color-picker`, `jolly-separator`,
`jolly-property-row`.

Nine of them are fields and carry the section 3 contract. `jolly-button` has no value, so
`default`, `Mixed` and revert are all meaningless on it, and `jolly-separator` and
`jolly-property-row` are layout. Those three are plain elements.

Three of the nine share shapes, so P3's `dispatch.ts` has one vocabulary to map rather than four:

```ts
export interface JollyOption<TValue> {
  value: TValue;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export interface Interval {
  from: number;
  to: number;
}
```

An array rather than Tweakpane's `Record<label, value>`, because a record keys the list by label,
so two options cannot share one, and there is nowhere to hang the `icon` an icon only segmented
rail needs. `Interval` uses `from` and `to` rather than `min` and `max` because `jolly-range`
carries bounds and a selection at once, and `range.min` next to `range.value.min` is a permanent
reading hazard.

`jolly-select` wraps a native element. The scope host's `color-scheme` themes native chrome, while
Select paints option rows with the raised surface so dropdown backgrounds remain explicit in both
modes.

`jolly-color` no longer wraps `input[type="color"]`. It cannot express alpha, it ignores every
token in section 4, and it forced a second code path for any editor wanting a themed picker. The
row is now a swatch button opening `jolly-color-picker`, which is a fourteenth element and the
one control that is a panel rather than a row: no label, `default`, `Mixed`, revert or `lockedBy`,
because those belong to the row hosting it. The accepted loss is the OS picker's eyedropper and
system palettes.

Values are hex strings, `#rrggbb` normally and `#rrggbbaa` when `alpha` is set, which keeps
`FieldValue<string>` and therefore `Mixed`, `default` and revert unchanged, and stays directly
usable as a CSS value. `parseColor` and `formatHex` ship so a consumer wanting alpha separately
does not write a fourth hex parser.

The panel holds an HSVA tuple rather than deriving handle positions from `value`. Hex cannot carry
hue at black, white or grey, so a derived picker collapses the hue handle to red the moment the
cursor enters a corner. The tuple survives whenever it still formats to the incoming value, which
is the consumer's own write-back returning, and re-derives otherwise, which is a peer edit, a
revert or a preset.

Placement is not the control's job. `PopoverController` owns anchored placement, repositioning
while open, focus restoration and the Escape hook, over a native `popover` the host renders. This
is what lets an editor build a brush swatch from the picker with no property row: `jolly-color` is
one consumer of the controller, not the only route to a popup. `jolly-floating` is the wrong tool
here, being a draggable, persisted, viewport-fixed panel rather than an anchored popup. CSS anchor
positioning is not used, since Firefox does not implement it.

The row therefore has no `inline` mode. An inline picker is the bare `jolly-color-picker` element,
placed where it is wanted.
Accepted limit: option rows cannot carry icons or peer chips. A richer variant stays additive
behind an attribute and is unscheduled until a consumer asks.

`jolly-button-group` is one tab stop with arrow key navigation, since that is what a segmented
control is and an eight option mode rail should not consume eight tab stops. `jolly-flags` keeps
native checkboxes in natural tab order, because its entries genuinely are independent.

### Containers and chrome

`jolly-pane`, `jolly-folder`, `jolly-tabs`, `jolly-tab`, `jolly-dock`, `jolly-floating`,
`jolly-dialog`, `jolly-toolbar`, `jolly-rail`, `jolly-icon`.

`jolly-split` is deferred. No current editor has a split-pane consumer, and a public component
would need decisions about slots, sizing, keyboard input and persistence that no use case can
answer yet.

### Data views

`jolly-tree` (drag and drop reparent, visibility and lock toggles), `jolly-list` (add, remove,
reorder, inline rename), `jolly-search`, `jolly-menu` (context menu), `jolly-toast`.

### Feedback

`jolly-progress` follows native progress semantics: a numeric `value` is determinate and a missing
value is indeterminate. It owns normalization, ARIA progressbar values, reduced motion, forced
colors and theme hooks. `jolly-loading` composes it into the branded runtime startup screen while
retaining the existing tag, completion timing, error view and `--jolly-loading-*` overrides.

### Math

`jolly-vector2`, `jolly-vector3`, `jolly-vector4`, `jolly-quaternion` (edited as Euler angles),
`jolly-transform`, `jolly-point2d` (inline 2D pad).

### Monitors

`jolly-stats` (compact cycling HUD, see section 6), `jolly-monitor` (label and value row inside
a pane), `jolly-graph` (sparkline over a ring buffer).

### Collaboration

`jolly-presence` (avatar stack and connection state), plus `lockedBy` on every field.

### Out of scope

Asset and object reference pickers (need `arbor`), block and tileset libraries, 3D preview
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
<jolly-dock side="left" collapsible>
  <jolly-pane heading="Layers">...</jolly-pane>
</jolly-dock>

<jolly-floating x="8" y="8">
  <jolly-pane heading="voxel.renderer">...</jolly-pane>
</jolly-floating>

<jolly-pane heading="Transform">...</jolly-pane>
```

Docked and floating share all content code. The facade defaults to wrapping in
`jolly-floating`, matching Tweakpane's default.

The docked wrapper is named `jolly-dock`, not `jolly-panel`, so no two tags differ by one
character.

`jolly-pane` owns content chrome. Its header renders when `title` is non-empty or the named
`actions` slot has content. Dock and Floating do not render another header. Pane and Dialog are
the two scope hosts in this phase; the other containers consume inherited tokens or the four
narrow fallbacks from section 4. The element constructor is exported as `PaneElement`, reserving
`Pane` for the P3 facade.

Folder expansion follows native details terminology. `open` defaults to `true`, header
activation updates `aria-expanded`, and `jolly-toggle` carries `{ open }`. A Pane only permits
folder reordering when it has the `reorderable` attribute. Reordering is limited to direct
`jolly-folder` children of that Pane; controls, arbitrary slotted content and folders in another
Pane do not enter the operation. Pane changes flattened slot order and never moves Lit-owned
light DOM nodes.

Each reorderable folder has a separate grip. Pointer input drags it. Keyboard input uses Space
to enter and finish reorder mode, Up and Down to move, and Escape to restore the starting order.
Moves are announced through a live region. Pane persists the committed order and emits
`jolly-reorder` with the resulting folder keys.

Tabs own their selected key as presentation state. An absent or invalid key selects the first
enabled tab. Selection remains externally settable and `jolly-change` reports user changes.
Tabs use roving focus with automatic activation: Left and Right navigate horizontal tabs, Up
and Down navigate vertical tabs, Home and End select the first or last enabled tab, and disabled
tabs are skipped.

Toolbar and Rail are stateless layout components. Toolbar supplies `role="toolbar"` and a
configurable orientation for inline actions. Rail is a persistent edge strip, vertical by
default, sized for 32px icon controls. Selection, commands, flyouts and roving focus stay in the
controls composed inside them.

### Resize

`@jolly-pixel/resize-handle` gains explicit bounds and an optional supplied handle. When a
handle is supplied, no sibling is injected. The existing misspelt `collapsable` option is
replaced by `collapsible`; this is a breaking change to that package.

```ts
export interface ResizeHandleOptions {
  direction: ResizeDirection;
  collapsible?: boolean;
  minSize?: number;
  maxSize?: number;
  /**
   * Use this element as the handle instead of injecting a sibling.
   * Lets a shadow root own the handle while the host stays the resize target.
   */
  handle?: HTMLElement;
}
```

Bounds default to zero and infinity. The package extracts its drag calculation into
`sizeFromDelta({ initialSize, startDrag, current, fromStart, min, max })`; pointer and keyboard
input call the same function. A handle is a focusable ARIA separator with its orientation and
current bounds exposed. The relevant arrow keys resize by 8px, or 32px with Shift.

`ResizeHandle.dispose()` is idempotent. It removes listeners, clears an active drag and its
document classes, and removes only a handle injected by the class. Caller-supplied handles stay
in their owning shadow root.

`jolly-dock` supports all four sides. Left and right docks resize their width; top and bottom
docks resize their height; the handle sits on the inward edge. Dock renders that handle in its
shadow root, targets itself, and ships its styling. Dock owns its collapsed state because a
ResizeHandle that applies `display: none` to the host would also hide a shadow-root handle.
Double click and Enter toggle collapse, the previous size is restored on expand, and both states
persist. This retires the `.resize-handle` block currently copied into three editors'
`public/main.css` after those editors migrate.

Floating uses fixed viewport coordinates, so document scroll never changes `x` or `y`. The
non-interactive part of its nested Pane header is the move handle. It resizes from independent
right and bottom handles. A pane that fits remains fully inside the viewport. If it is wider or
taller than the viewport, the overflowing axis is anchored at zero so the leading title region
stays reachable. The same clamp runs on connect, move, resize and viewport resize.

Floating instances raise themselves within their document or shadow-root stacking context on
pointer interaction or `focusin`. Stack order is transient and an explicit consumer z-index
override wins. Position, width and height persist; z-index does not.

`html.handle-dragging` stays on `document.documentElement`, because suppressing pointer events
during a drag cannot work from inside a shadow root. The package injects that one rule once.

### Dialogs

`jolly-dialog` wraps the native `dialog` element and `showModal()`, which supplies the top
layer and focus trapping. `::backdrop` is styled inside the component's shadow styles.
`dismissible` defaults to `true`, making Escape and backdrop clicks cancellation paths. Setting
it to `false` leaves explicit actions in control. An explicit `theme` wins; otherwise opening
adopts the nearest themed parent, or the active invoking control for a helper attached to the
document body.

An imperative helper mirrors the existing `showPrompt()` in voxel-map:

```ts
const name = await showPrompt({ label: "Layer name" });
```

The helpers stay small:

```ts
showPrompt({ title?, label, defaultValue?, confirmLabel?, cancelLabel? });
showConfirm({ title?, message, confirmLabel?, cancelLabel?, danger? });
```

They accept strings. Declarative Dialog handles validation, rich content and custom forms.
`showPrompt()` resolves `string | null` and trims confirmed input; `showConfirm()` resolves a
boolean. Escape, Cancel and backdrop dismissal resolve `null` or `false`. Cancellation is not an
exception. Each helper uses `Promise.withResolvers` and removes its element exactly once after
settlement. Helpers compose `jolly-text` and `jolly-button` so their fields and actions use the
same theme and state styling as declarative content.

## 8. Collaboration

`ui` core depends on nothing network related. It declares a port and owns the presence schema,
because `PeerMetadata` in `@jolly-pixel/network` is an untyped `Record<string, unknown>`.
Collaboration types and display components live under `src/peer/`.

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

`jolly-presence` is the transport-free snapshot view for a Pane or Folder. Its
`peers` property receives ordered `PresencePeer` entries (`id`, `username`,
CSS `color`, optional `self`); its `max` property caps named rows, preserving
the local peer when the cap permits. `Pane#addPresence()` and
`Folder#addPresence()` return a facade with `update(peers)`. It renders the
inclusive connection count, a polite live summary, color swatches, `(you)`,
and `+N more` when capped. Username editing remains host-owned.

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

export interface QuatLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface TransformLike {
  readonly position: Vec3Like;
  readonly rotation: QuatLike;
  readonly scale: Vec3Like;
}
```

`THREE.Vector3` and `THREE.Quaternion` satisfy `Vec3Like` and `QuatLike` already, so 3D editors
pass `mesh.position` and `mesh.quaternion` directly, while 2D consumers of a button or a color
swatch never pull a 3D library. `THREE.Object3D` is not itself `TransformLike`; a one line
adapter (`{ position: mesh.position, rotation: mesh.quaternion, scale: mesh.scale }`) is expected
at the call site.

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

### Per-axis value and Mixed

Section 3's `FieldValue<T> = T | typeof Mixed` is all or nothing, but a vector field applies
Mixed per axis: editing one axis of a mixed selection commits that axis across the selection and
leaves the others Mixed. `value` is therefore a union rather than `FieldValue<Vec3Like>`:

```ts
export type VectorValue<TAxis extends string> =
  | Record<TAxis, number>
  | Record<TAxis, FieldValue<number>>
  | typeof Mixed;
```

A plain `Vec3Like`-shaped object (`Record<"x" | "y" | "z", number>`) is the common, direct
binding case: `<jolly-vector3 .value=${mesh.position}>` needs no wrapping. The per-axis
`FieldValue` record only appears under multi-selection, where one or more axes differ across the
selected objects. Whole-value `Mixed` still covers "every axis differs, none has been touched
yet."

`jolly-input`/`jolly-change` emit `detail.value` typed as the same `VectorValue<TAxis>` union as
`value`. An edited axis becomes a concrete number; untouched axes keep whatever they were,
including `Mixed`. There is no principled concrete number to substitute for a still-Mixed axis
that was never displayed as one — forcing one would silently pick a value for objects in the
selection the user never touched.

`default`, and therefore the Modified state and revert affordance, apply to the whole row, not
per axis: `default` is `Vec3Like`-shaped, one leading bar and one revert action, resetting every
axis together.

### Composition

`jolly-vector2`, `jolly-vector3`, and `jolly-vector4` share one abstract `VectorField extends
JollyField<VectorValue<TAxis>>`, generic over an axis-key list (`["x","y"]`, `["x","y","z"]`,
`["x","y","z","w"]`). `renderValue()` draws one bare axis box per key, wired directly to
`ScrubController`, `valueFromDelta`, and `evaluate` — the same expression grammar `jolly-number`
uses, not a reduced one. There is no nested `jolly-number`: a full field row (label, gutter, lock
ring) per axis would duplicate the row chrome this base class already renders once.

Each axis box carries a small corner-triangle color chip, seeded from the same axis colour
tokens `Vec3Input` used (`--jolly-axis-x`, `-y`, `-z`), purely as a sighted-user visual accent.
It is not the scrub handle — `jolly-number`'s existing left-handle drag grip is unchanged — and it
is not the only means of conveying axis identity: each box carries `aria-label="X"` / `"Y"` /
`"Z"` / `"W"` (overridable per instance for domain terms like `"pitch"`), matching how peer color
chips in section 4 always resolve to a name, never color alone.

`jolly-vector4` has no named consumer today. It ships anyway for API symmetry with the other two
— the three share literally all their code, unlike a whole extra facade class built ahead of a
consumer.

`jolly-point2d` is not a third value shape. It reuses the two-axis `Vec2Like` (`Record<"x" |
"y", number>`) but renders a draggable pad surface instead of two boxes, with optional `min`,
`max`, and `step` attributes the same way `jolly-slider` bounds a scalar. It has no named
consumer today either, and is recorded as speculative on the same footing as `jolly-vector4`.

`jolly-quaternion` is edited as Euler angles but its `value` is `QuatLike`. Quaternion to Euler
is not a unique conversion — many Euler triples produce the same quaternion, and near gimbal
poles a small quaternion change can jump the derived angles onto a different triple. The element
holds an internal Euler draft that survives across renders the same way `jolly-color-picker`'s
HSVA tuple does (section 5): it persists as long as converting it back to a quaternion still
equals the incoming `value` within an epsilon — i.e. the user's own edits keep echoing back — and
re-derives fresh only on a genuine external change: a peer edit, a revert to default, or an
incoming value that does not round trip to the cached triple. Conversion uses Euler order
`"XYZ"`, matching `THREE.Euler`'s own default, so round tripping a mesh's rotation needs no
explicit order argument. `euler.ts` implements the conversion, about 40 lines; it is not part of
the public barrel, the same treatment P0 gave `evaluate` and `valueFromDelta`.

`jolly-transform` composes `position` (`jolly-vector3`), `rotation` (`jolly-quaternion`), and
`scale` (`jolly-vector3`) as three independently labeled, independently lockable field rows. It
is a plain `LitElement`, not itself a `JollyField`: locking, Mixed, and revert are meaningful per
sub-property — a consumer can lock just rotation — so there is nothing coherent for an outer
field wrapper spanning all three to contribute.

## 11. Persistence

Layout state persists through a pluggable adapter. P2 stores folder order and expansion, dock
size and collapse, and floating position and size. Tab selection is application state and does
not persist automatically. Theme and density persistence belongs to the application or gallery
shell.

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

Pane, Dock and Floating namespaces derive from `location.pathname`, tag name, nested Pane title,
side where applicable, and occurrence index. Editors sharing `localhost` in development do not
overwrite each other. `storage-key` overrides the derived namespace. A development warning
fires when occurrence is needed to distinguish otherwise identical stateful containers.

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
- `jolly-reorder` carries the committed folder keys and `jolly-revert` carries affected field
  keys. Both are pane level
- Dock and Floating emit `jolly-resize` continuously and `jolly-resize-end` on commit. Resize
  details carry `{ width, height }`; Dock also includes `collapsed`
- Floating emits `jolly-move` continuously and `jolly-move-end` on commit, carrying `{ x, y }`
- Pointer, keyboard and collapse operations use the same resize event path. No resize-start or
  move-start event ships without a consumer
- Every element declares its tag in `HTMLElementTagNameMap`

Field events carry the value and nothing else:

```ts
export interface JollyChangeDetail<TValue> {
  value: TValue;
}
```

They are not cancelable. Section 2 already forbids the element from mutating itself, so there is
nothing for `preventDefault()` to prevent, and a cancelable event that ignores cancellation is a
trap.

A field's revert gutter is not a third kind of change: it commits `default` through
`jolly-change`, which keeps one write back path and gives consumers nothing extra to branch on.
That is why `jolly-revert` above is pane level, matching the plural keys it carries.

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

Size-from-delta is deliberately absent. `resize-handle` owns that calculation, and `jolly-dock`
delegates resizing to the same package, so a copy here would not exercise the code that runs. P2
extracts and clamps it there.

End to end tests run with Playwright against the examples gallery, following the pattern in
`editors/pixel-art`: `testMatch: "**/*.e2e.ts"` so the two runners never collect each other's
files, a `webServer` booting the Vite dev server, and workers isolated from one another.

happy-dom has no layout engine and no CSS cascade, so resize geometry, floating placement, drag
and drop hit testing and `light-dark()` resolution belong to the end to end tier.

Note for any test that does import Lit: Lit resolves to its Node export condition, and
`@lit/reactive-element/node/css-tag.js` reads `Document.prototype` at import time. A setup file
must register `Document`, `ShadowRoot`, `CSSStyleSheet` and `HTMLTemplateElement`, which the
existing `pixel-draw-renderer` setup does not.

A harder constraint sits underneath that one. Components use decorators, matching `PixelDrawPanel`
and `Vec3Input`, and a decorator is not erasable syntax: `node --test` strips types rather than
compiling, so importing a decorated module fails with a `SyntaxError` at parse before a single
test runs. **No spec can import a component.**

That is not a limitation to work around, it is a constraint that decides where logic lives.
Anything worth a unit test is a plain module the element calls:

Numeric field support lives in `src/numeric/`. Expression parsing, display and quantisation,
modifier scaling, and pointer-delta stepping are shared numeric-control mechanics; generic DOM
event guards remain separate in `src/dom.ts`.

```
src/field/predicates.ts    isModified(value, default)
src/numeric/format.ts      formatNumber(value, step), parseNumeric(text)
src/controls/flags.ts      mask to selection, selection to mask, toggle
src/numeric/valueFromDelta.ts    already P0
src/numeric/evaluate.ts          already P0
```

Everything a component renders is therefore covered by the end to end tier alone, which is the
tradeoff the two tier split already accepts.

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

- **Component examples** render one component through a shared state matrix helper, each row
  tagged `[data-state]`. All of them stay identical, and adding a state updates every component
  example at once. Nine rows: `default`, `mixed`, `modified`, `error`, `disabled`, `readonly`,
  `locked`, `peers`, `mixed+modified`. Focus is not among them, because only one element can hold
  it: the locked plus focused case is produced by the test focusing the `locked` row. The helper
  takes a factory rather than a tag name, since a `select` needs `options` and a `slider` needs
  bounds, and each row builds a fresh element so one row's draft cannot leak into another
- **Scenario examples** cover one behaviour with whatever setup it needs, which no component
  example can provide: input scope with a live viewport, locking with two peers, reorder
  persistence across a reload, the three densities, stats cycling under a frame loop

### Addressing examples from tests

The gallery is chrome that tests must be able to opt out of. It uses a `jolly-dock` containing a
reorderable Pane. Manifest groups render as `jolly-folder` elements containing semantic `nav`
links; `jolly-list` remains in P5. The Pane actions slot holds the theme button group and density
select. The shell otherwise shares fate with several P2 components, so it keeps its own suite.

Extending the query parameter approach already used by `editors/pixel-art`:

| URL | Renders |
|---|---|
| `/` | Full gallery, first example selected |
| `/?example=controls/slider` | Full gallery, deep linked |
| `/?example=controls/slider&chrome=off` | The example alone, no dock or navigation |

One mechanism, not two. An earlier draft also offered hash routing (`/#/controls/slider`) for the
same job, which buys history handling, a precedence rule for when both forms are present, and two
code paths to test. The query parameter is what tests use, what `chrome=off` composes with, and
what `editors/pixel-art` already does with `?empty`.

Tests use the last form and gate on a `window.__galleryReady` flag, mirroring
`__pixelSyncReady`. The shell suite verifies every manifest link, selection and history,
deep links, `chrome=off`, theme and density controls, folder order persistence, and dock width
across reload.

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

The root barrel exports the elements themselves, so importing it registers every custom element
as a side effect. Three editors consume this package wholesale, and per component subpaths would
be speculative under the rule above. The consequence is that `package.json` must never claim
`"sideEffects": false`: a bundler taking that at its word drops the `customElements.define` calls
and every tag renders as an unknown element.

`JollyField`, `ScrubController` and the extracted pure helpers stay out of the barrel. This
package publishes with `access: public`, so promoting one later is additive while withdrawing one
is breaking, which is the rule P0 set for `evaluate` and `valueFromDelta`.

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
| An inset ring inside the control for the lock | Doubles with the border an input already has, floats detached on a borderless range, and boxes a whole group of checkboxes |
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
| `jolly-property-row` owning label, gutter and chips | Every field would need a wrapper, so P5 and P6 migrate one hand written row into two elements, and P7 could no longer light up locking from one file |
| A field mixin or reactive controller instead of a base class | A controller cannot render the chrome around the value, so P7 wiring `lockedBy` would edit twelve files instead of one; a generic mixin loses `T` and needs it redeclared per control |
| A precedence chain over `disabled`, `readonly` and `lockedBy` | The same failure as the rejected single ring: a locked field stops showing that it is also disabled |
| The element writing its own `error` | It replaces a consumer's validation message on the first typo and clears it afterwards, so the consumer cannot trust a property it set |
| A `jolly-error` event with no local rendering | Every numeric field needs the same write back boilerplate, and forgetting it makes a typo do nothing at all |
| A `source` discriminator on the change detail | `jolly-input` against `jolly-change` already separates continuous from committed, which is the distinction consumers ask for |
| Scrubbing a mixed field from a synthesised start | The first pointer move collapses the whole selection onto a value the user never saw, in one undo step |
| Fallbacks on every token usage | Re-inlines the palette across every stylesheet, and a single value cannot carry `light-dark()` |
| Authoring icons on a 16 viewBox | A 24 viewBox at 2.25 renders identically at 16px, and pixel-art's 27 glyphs are already drawn on it |
| A closed icon record | `voxel-map`'s domain glyphs could not be used on a `JollyOption`, so `ui` would have to absorb a cube |
| Exporting `JollyField` in P1 | Publishes a subclassable base, its protected surface and its DOM shape as versioned API before any consumer subclasses it |
| Screenshot snapshots in the end to end tier | Baselines are per platform, development is Windows against Linux CI, and the tier is already the flaky one |
| Authoring components without decorators | Would allow happy-dom component tests, but diverges from `PixelDrawPanel` and `Vec3Input` and re-litigates a settled test tier split |
| Keeping `input[type="color"]` in `jolly-color` | Cannot express alpha, ignores every section 4 token, and a `native` opt-out would ship two divergent paths through one control |
| A structured `{ r, g, b, a }` colour value | Breaks `FieldValue<string>`, needs a `hasChanged` comparator, and makes consumers format before painting |
| A hex string plus a separate `alpha` property | One drag of the alpha track then emits changes for two properties, so a consumer reconciles two events per gesture |
| Deriving picker handles from `value` alone | Hue is unrepresentable at black, white and grey, so the hue handle snaps to red whenever the cursor enters a corner |
| Holding HSVA as permanent canonical state | Two rows bound to one colour drift apart, since neither ever re-reads the value |
| Four-digit `#rgba` input | Collides with partial input: `#ff66`, typed on the way to `#ff6600`, would commit instead of reporting incomplete |
| `jolly-floating` as the picker's popup | It is a draggable, persisted, viewport-fixed panel, not an anchored popup, and it expects a nested Pane |
| An absolutely positioned panel in the shadow root | Clipped by any scrolling ancestor, and `jolly-color` rows live inside scrolling docks |
| Tweakpane-style inline row expansion | Shifts every row below it on open, and fights folder reorder and persisted layout |
| CSS anchor positioning for the popup | Firefox does not implement it, so placement stays in JS |
| An `inline` mode on `jolly-color` | The bare `jolly-color-picker` element already is the inline picker |
| Popup placement inside `jolly-color` | An editor wanting a brush swatch with no property row would reimplement anchoring, Escape and focus restoration; `PopoverController` is the reusable half |
| Canvas for the picker surfaces | CSS draws these gradients natively, and canvas cannot read the theme's custom properties |
| An inset face on the swatch | The frame reads as a border drawn around the sample, and a colour has to fill its control to be judged |
| Ok and Cancel buttons in the panel | Escape already cancels and the picker commits continuously, so the row costs vertical space in a panel meant to be compact |
| An eyedropper and preset swatches | `EyeDropper` is Chromium-only and neither has a consumer, so both would ship speculatively |
| One documentation page per component | Twelve pages each repeating one shared contract, against the preference to fold shared material into an owning doc |

## 16. Open points

- Whether `jolly-tree` virtualizes. Deferred until a consumer exceeds a few hundred nodes
- Whether pane state beyond order persists through Tweakpane style `exportState` and
  `importState`. Decided in P3 not to build it: none of that phase's migrated examples need it,
  and there is no consumer to validate a serialisation format against. Stays open until one asks
- Whether user rebindable shortcuts are needed, and if so where the overrides persist. The
  registry makes it possible; nothing currently asks for it
- Whether `jolly-flags` needs per bit mixedness. A bitmask across a multi selection genuinely is
  mixed bit by bit, which `FieldValue<number>` cannot express. Whole value `Mixed` ships in P1;
  the finer form waits for a multi selection consumer, which is P5 at the earliest
- Relative multi edit is not expressible. `{ value: T }` carries one absolute value, so section 3's
  "applies that axis to the whole selection" is the whole of it. Unity applies a delta to each
  selected object instead, which would need a second detail shape and a second write back path
- Whether `JollyField` becomes public. P5 and P6 will say whether an editor wants a domain field
  with lock, mixed and revert; promoting it then is additive
- How a field acquires a lock path. Section 8's `claim(path)` needs an identity that section 11's
  `deriveKey` only gives to a pane. Decided in P7, with its first claimant
