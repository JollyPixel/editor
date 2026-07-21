# `PixelArtCanvas` architecture review

> Status: proposal / discussion. No code has changed. Line references are a
> snapshot of branch `pixel-draw-return-type-interface` and will drift.

## Context

`PixelArtCanvas` (765 lines) sits at the center of a constellation of helper
classes — `SyncController` (302), `ToolControllers` (88) wrapping five
`*Controller` tools, `SelectController` (515), `createInputActions` (252),
`InputController` (493), `CursorController`, `SvgManager`, `HistoryController`.
The recurring complaint: too many "Controller" classes and helper functions
that mostly exist to thread references between objects. This document diagnoses
why and proposes an OOP-oriented restructuring. Breaking API changes are
acceptable.

---

## 1. Diagnosis — what's actually hurting

The complaint is accurate and has **three concrete symptoms**, not one.

### Symptom A — Callback tunneling (the reference-threading pain)

After an edit, a tool must do the same thing: *record history → emit a network
hook → call `onDrawEnd`*. But tools don't do that themselves. They take an
`onCommit` callback, which `PixelArtCanvas` fills in with an inline closure that
calls back into `SyncController`. Every edit travels:

```
BrushController → onStrokeCommit closure (PixelArtCanvas.ts:278) → sync.recordHistory + sync.emitHook + onDrawEnd
FillController  → onGlobalFillCommit closure (:293)              → sync.applyStroke + recordHistory + emitHook + onDrawEnd
SelectController→ onSelectCommit closure (:306)                 → sync.recordHistory + onDrawEnd   ← note: no hook!
PixelArtCanvas.commitPixels (:613)                              → sync.applyStroke + recordHistory + emitHook + onDrawEnd
```

That is the *same ritual written four times, four slightly different ways*.
`ToolControllers` exists mostly to carry five `onCommit` callbacks
(`ToolControllers.ts:35-39`) from `PixelArtCanvas` down to the tools. The
45-line closure block at `PixelArtCanvas.ts:269-313` **is** the
"references between objects" problem in physical form. The asymmetry
(select-edit emits no network hook) is invisible precisely because the logic is
scattered across four sites.

### Symptom B — Mode is a primitive switched on in ~5 places

`Mode` is a string union, and mode-specific behavior is smeared across:

- `createInputActions.ts` — a `switch (getMode())` in nearly every one of ~15 handlers.
- `PixelArtCanvas.mode` setter (`:347-365`) — a cascade of `if (mode === X)` cleanup calls.
- `CursorController.#resolve` (`:32`) — another mode switch.
- The `brushAdapter` / `const self = this` hack (`:246-267`) — reaches into
  `self.#mode` and `self.#tools.brush.pickArmed` to decide highlight size.

Adding a mode means editing all of these. No single object owns "what `select`
mode *is*."

### Symptom C — The facade does real work *and* is ~60% delegation

`PixelArtCanvas` is two things fused together:

- **A thin delegating facade**: `fillGlobal`, `selectShape`, `pickColorArmed`,
  `rotateSelection`, `flipSelection*`, `backgroundColor` — pure forwarders to
  `#tools.*` / `#renderer` (`:370-522`).
- **A real orchestrator**: `commitPixels`, `undo`, `redo`, and the
  `texture` / `textureSize` setters all build history entries and sequence hooks
  inline (`:452-489`, `:570-690`).

The 180-line hand-wired constructor (`:162-341`) is order-dependent dependency
injection done by hand.

---

## 2. Root cause

**The coordination logic lives in `PixelArtCanvas` (as closures) instead of in
the objects that own the data**, so `PixelArtCanvas` must hold references to
everything and hand those references to everyone.

`SyncController` was clearly *meant* to be the coordinator — but it exposes
**primitives** (`recordHistory`, `emitHook`, `applyStroke` as separate calls)
instead of **intents** (`commitStroke`), so callers still have to sequence them
correctly, and `PixelArtCanvas` became the place that does the sequencing.

---

## 3. Recommendations, prioritized

### ⭐ R1 — Turn `SyncController` into an intent-level `EditPipeline`; delete the closures ✅ DONE

**Value: highest. Effort: medium. Risk: low (behavior-preserving).**

> **Status: implemented.** `SyncController` renamed to `EditPipeline`
> (`src/sync/EditPipeline.ts`) exposing intents `commitStroke`, `commitPixels`,
> `commitGlobalFill`, `commitSelectionEdit`, `resize`, `replaceTexture`; the
> underlying primitives (`applyStroke`, `resizeTexture`, `replacePixels`,
> `recordHistory`) are now private. Tools take `pipeline` by constructor
> injection and call the intents themselves, so the 45-line closure block, the
> five `onCommit*` fields on `ToolControllers`, and the duplicate ritual in
> `commitPixels` / the `texture` + `textureSize` setters are gone. The
> select-edit hook asymmetry noted below is preserved (documented on
> `EditPipeline.commitSelectionEdit`) rather than changed, since R1 is
> behavior-preserving. All 644 tests pass.

Push the ritual *down* into the coordinator. Give it semantic methods, one per
edit kind, each of which internally performs the full
apply→history→hook→`onDrawEnd` matrix:

```ts
class EditPipeline {                     // renamed SyncController
  commitStroke(pixels: Vec2[], color: RGBA, beforeColors: RGBA[]): void;
  commitGlobalFill(commit: FillGlobalCommit): void;
  commitSelectionEdit(entry: SelectEditEntry): void;   // now obviously missing a hook; fix here, once
  resize(size: Vec2): void;
  replaceTexture(source: HTMLCanvasElement | HTMLImageElement): void;
}
```

Then **tools depend on the pipeline directly** (constructor injection) and call
`pipeline.commitStroke(...)` themselves. This removes:

- the entire closure block (`PixelArtCanvas.ts:269-313`),
- the five `onCommit*` fields threaded through `ToolControllers`,
- the duplicate ritual in `commitPixels`, which becomes `this.#edits.commitStroke(...)`.

This is the change that most directly kills the "maintain references between
objects" complaint, and it's mechanical because the behavior already exists —
you relocate it rather than redesign it.

### ⭐ R2 — Expose tools as public fields; delete the delegation getters

**Value: high surface reduction. Effort: low. Breaking API change.**

This is already done for `brush`, `viewport`, `uv`, and it matches the recorded
preference (expose the object, not a re-wrapped getter/setter pair). Apply it to
the rest:

```ts
// before: canvas.fillGlobal = true; canvas.selectShape = true; canvas.rotateSelection();
// after:  canvas.tools.fill.global = true; canvas.tools.select.shape = true; canvas.tools.select.rotate();
```

Make `tools` a public readonly field and delete `fillGlobal`, `selectShape`,
`pickColorArmed`, `pickColorAt`, `rotateSelection`,
`flipSelectionHorizontal/Vertical` (~90 lines gone). The tools' own APIs become
the single source of truth instead of being re-wrapped one property at a time.

### R3 — Introduce a `CanvasTool` strategy to collapse the mode switches

**Value: high. Effort: higher — do after R1/R2.**

One object per mode, implementing the behavior currently scattered:

```ts
interface CanvasTool {
  onPointerDown(pos: Vec2, button: Button, mods: Mods): boolean;
  onPointerMove(pos: Vec2): void;
  onPointerUp(): void;
  onActivate(): void;                      // replaces the mode-setter cleanup for entering
  onDeactivate(): void;                    // replaces the `if (mode !== X)` cascade
  cursor(): string;                        // replaces CursorController.#resolve
  highlight(): BrushHighlightSpec | null;  // replaces the brushAdapter / self hack
}
```

Payoff:

- `createInputActions`' per-handler switches collapse to `this.#active.onPointerDown(pos, …)`.
- The `mode` setter becomes `this.#active.onDeactivate(); this.#active = tools[mode]; this.#active.onActivate()`.
- `CursorController` and the `brushAdapter` / `self` closure both dissolve into the tool.

Caveats to design around:

- "paint" is a *composite* mode (brush + line + color-pick coexist), so
  `PaintTool` internally owns those three — it is not a strict 1:1 mode→tool map.
- Keyboard edits (copy / paste / rotate / flip) currently always route to
  `select`; these become optional `CanvasTool` methods.

Because it is the biggest change, stage it last.

### R4 — Group into Model / View, leave `PixelArtCanvas` as assembler

**Value: clarity. Effort: medium.**

There is a latent MVC here:

- **Model** — `CanvasBuffer` + `UVMap` + `HistoryController` → a `PixelDocument`.
- **View** — `CanvasRenderer` + `SvgManager` + overlays + `Viewport` → a `CanvasView`.
- **Coordinator** — `EditPipeline` (R1) + tools (R3).

Each layer wires its own internals in its constructor, so `PixelArtCanvas`'s
constructor shrinks to `new PixelDocument()` → `new CanvasView(doc)` →
`new EditController(doc, view)`. `#computeFitZoom` and the background-color
resolution move into `CanvasView`.

### R5 — Fix the overloaded "Controller" suffix

**Value: naming clarity.**

"Controller" currently means four different roles: tool behavior
(`BrushController`), a coordinator (`SyncController`), a view helper
(`CursorController`), a stack wrapper (`HistoryController`). Rename by role:
tools → `BrushTool` / `FillTool` / `SelectTool` (or fold into R3),
`SyncController` → `EditPipeline`, `CursorController` → dissolve into tools,
`HistoryController` → `History`.

---

## 4. Suggested end state

```
PixelArtCanvas            ← thin facade: assemble + expose document/view/tools
├── PixelDocument         ← CanvasBuffer + UVMap + History (the model)
├── CanvasView            ← CanvasRenderer + SvgManager + Viewport + overlays
├── EditPipeline          ← the ONE place edits become history + hook + draw (ex-SyncController)
└── InputController → activeTool: CanvasTool
                            ├── PaintTool (brush + line + pick)
                            ├── FillTool
                            ├── SelectTool
                            ├── UVTool
                            └── MoveTool (no-op)
```

---

## 5. Migration path (each step ships independently)

1. **R1** — pull intents into `EditPipeline`, point tools at it, delete the
   closure block. *Behavior-preserving, mechanical.*
2. **R2** — expose `tools`, delete delegation getters.
3. **R4** — extract `PixelDocument` / `CanvasView`, shrink the constructor.
4. **R3** — introduce `CanvasTool`, migrate one mode at a time (start with
   `fill` / `move`, the simplest), retiring `CursorController` and the
   `brushAdapter` hack as you go.
5. **R5** — rename in the same PRs that touch each class.

**Recommendation: do R1 + R2 first.** Together they remove the closure
tunneling and ~130 lines from `PixelArtCanvas`, they are low-risk, and they set
up R3/R4 without committing to the larger State refactor yet. R3 is the
highest-ceiling change but is only worth reaching for once R1 has proven the
intent-level pipeline.
