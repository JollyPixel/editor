# `@jolly-pixel/ui` — `src/` architecture review

Scope: every file under `packages/ui/src` (13,465 lines, 96 files). Read-only audit.
Focus per request: structural drift accumulated as features landed, not behaviour.

The library works and the code is unusually well-commented — most non-obvious decisions
carry a rationale, which is rare and worth keeping. The problem is not local quality. It
is that **four or five policies are implemented once per element instead of once**, and
the container layer has grown a set of stringly-typed seams that the type system no
longer covers. Below, ordered by how much complexity a fix would *delete*.

---

## 1. The managed/unmanaged persistence duality is written four times

`Dock`, `Pane`, `Floating` and `Folder` each independently carry:

| Piece | Dock | Pane | Floating | Folder |
|---|---|---|---|---|
| `storage-key` property | ✔ | ✔ | ✔ | ✔ |
| `storage` property + `new LocalStorageAdapter()` in ctor | ✔ | ✔ | ✔ | ✔ |
| `#managed = closest("jolly-dock-layout") !== null` | ✔ | ✔ | ✔ | — |
| `#namespace()` with `globalThis.location?.pathname` fallback | ✔ | ✔ | ✔ | ✔ (variant) |
| `#restore()` / `#persist()` forking on `#managed` | ✔ | ✔ | ✔ | — |

`Dock.ts:510`, `DockLayout.ts:750`, `Floating.ts:429`, `Pane.ts:723` are four copies of the
same six-line function. `Dock.#persist` (`Dock.ts:477`), `Floating.#persist`
(`Floating.ts:403`) and `Pane.#toggleCollapsed` (`Pane.ts:342`) are three copies of the
same `if (managed) emit dirty else storage.set(...)` fork.

This is one policy — *"either I own my state, or the layout above me does"* — spread across
four elements as a boolean each of them re-derives.

**Code judo.** One `PersistedState` reactive controller owning `storage`, `storageKey`,
managed detection, namespace derivation, and a two-method surface:

```ts
#state = new PersistedState(this, {
  scope: () => `jolly-dock:${this.layoutKey}`
});
// ...
this.#state.write("size", String(this.size));   // routes to jolly-layout-dirty when managed
this.#state.read("collapsed");                  // returns null when managed
```

Each element loses ~40 lines and one boolean. More importantly, the *rule* becomes
reviewable in one place instead of four.

### 1a. `Folder` opted out of the duality, and that is a real gap

`Folder` has no `#managed` and always writes straight to storage (`Folder.ts:145-165`). So a
folder inside a *managed* pane persists its open state to its own `localStorage` keys, outside
the layout snapshot. Consequence: **`DockLayout.resetLayout()` does not reset folder open
state** — it clears the snapshot namespace, and the folder keys survive. The centralised
controller above closes this by construction; today it is an asymmetry nobody can see from
either file alone.

---

## 2. Folder identity is a string surgically extracted from a persistence key

`Pane` computes real folder keys in `#folderKeys()` (`Pane.ts:659`), throws them away into a
concatenated string (`folder.persistenceKey = ${namespace}:folder:${keys[index]}`,
`Pane.ts:489`), then recovers them by string surgery in **three** places:

```ts
// Pane.ts:615, :690, :702
folder.persistenceKey.split(":folder:").at(-1) ?? ""
```

Alongside it, the *ordering* model is encoded in inline CSS and read back by parsing it:

```ts
// Pane.ts:682
[...this.#folders].sort((l, r) => Number(l.style.order) - Number(r.style.order));
```

So the two facts the reorder logic needs — which folder is which, and what order they are
in — are both round-tripped through strings that exist for other reasons. Any folder whose
key contains `:folder:`, or whose `persistenceKey` was set by an author, silently
mis-resolves.

**Code judo.** Hold one ordered model and reorder *it*:

```ts
#entries: { folder: Folder; key: string; }[] = [];
```

`#orderedFolders`, `#orderedKeys`, all three `split(":folder:")` calls and the
`Number(style.order)` sort disappear. `#applyOrder` becomes a single pass writing
`style.order` as pure output, never as input.

---

## 3. `Pane.ts` (782 lines) is two elements sharing a file

Roughly 250 of those lines have nothing to do with being a pane. They are a folder-list
manager: `#folders`, `#onContentChange`, `#onFolderDrag`, `#onReorderCommand`, `#moveFolder`,
`#folderKeys`, `#orderedFolders`, `#orderedKeys`, `#applyOrder`, `#commitOrder`, plus the
module-level `parseOrder`. The pane hosts them only because it happens to be the element that
slots folders.

**Extract `FolderListController`** (a Lit `ReactiveController`, same shape as the existing
`ScrubController`/`PopoverController`). Pane drops to ~450 lines and reads as one thing; the
reorder logic becomes unit-testable without instantiating a custom element — which matters
given this package's stated test tiering (unit for low-DOM logic, Playwright for the rest).
Combined with §2 this is the single highest-value restructuring in the package.

---

## 4. The numeric text-draft field is implemented four times

`Number`, `Slider`, `Color` and `ColorPicker`'s alpha readout each carry a near-identical
quadruplet:

```
#onType    → setDraft(target.value); setParseError(null)
#onKeyDown → Enter → #commit(); Escape → stopPropagation(); clearDraft()
#onBlur    → pointerFocus.onBlur(); #commit()
#commit    → parse → null: clearDraft | !ok: setParseError | ok: emitChange(quantize(...))
```

Compare `Number.ts:125-216`, `Slider.ts:163-221`, `Color.ts:234-282`,
`ColorPicker.ts:289-343`. Only the parse function differs. Alongside it, this nine-line
attribute block is copy-pasted verbatim into `Text`, `Number`, `Slider`, `Range` and `Color`:

```html
?disabled=${this.disabled}
?readonly=${this.inputReadonly}
?data-pointer-focus=${this.#pointerFocus.active}
aria-readonly=${this.readonlyAria}
aria-disabled=${this.lockedAria}
aria-description=${this.lockDescription}
aria-invalid=${this.displayError === null ? nothing : "true"}
```

`JollyField` already owns `draft`/`setDraft`/`clearDraft`/`setParseError` — the state is
central, only the *protocol over it* was left to each subclass.

**Code judo.** Push the protocol into `JollyField` as a template method:

```ts
protected abstract parseDraft(text: string): DraftResult<TValue> | null;
protected renderDraftInput(extra: DraftInputOptions): TemplateResult;
```

Four `#commit` methods collapse into one; the ARIA block is written once. Each control keeps
only what is genuinely its own — `parseNumeric`+`quantize` for numbers, `parseColor`+`formatHex`
for colour.

---

## 5. `Range` bypasses the canonical numeric parser

```ts
// Range.ts:170
const parsed = Number(event.target.value.trim().replace(",", "."));
```

`parseNumeric` (`numeric/format.ts:35`) is the canonical entry point and routes through
`evaluate.ts` (311 lines of expression support). The consequence is a user-visible contract
split: `jolly-number` and `jolly-slider` accept `2*3` and surface a parse error on bad input;
`jolly-range` accepts neither and silently swallows both. `Range` also has no draft path at
all — it commits on `@change` only — so `displayError`/`setParseError` can never fire for it
despite the base class rendering the error row.

This is a bespoke helper standing in for one that already exists, and it should reuse the
canonical one. §4's shared draft protocol makes that the path of least resistance.

---

## 6. `Select` reimplements `PointerFocusController` inline

`Select.ts:38, 98-122` is a verbatim reimplementation of
`interaction/PointerFocusController.ts` — same `#active` field, same
`onFocus`/`onBlur`/`onKeyDown` triple, same `requestUpdate` guard — while `Text`, `Number`,
`Slider`, `Range` and `Color` all use the controller. Delete the copy.

---

## 7. Three copies of "lazily inject a document-level cursor-lock stylesheet"

| Function | File | Marker |
|---|---|---|
| `ensureSessionStyles` | `interaction/DragSession.ts:539` | `id="jolly-drag-session-styles"` |
| `ensureDragStyles` | `interaction/dragStyles.ts:7` | `id="jolly-drag-styles"` |
| `installResizeCursorStyles` | `containers/resize.ts:10` | `[data-jolly-resize-cursors]` |

Same shape, three idioms for the idempotency check, two folders. One
`ensureDocumentStyles(id, css)` in a shared module removes two files' worth of ceremony.

Note also that only `ensureDragStyles` guards `typeof document === "undefined"`; the other
two would throw under SSR. Three copies means three different sets of assumptions.

---

## 8. Two copies of "resolve a shadow-scoped token off a host"

`DragSession.resolveToken`/`resolveAccent` (`DragSession.ts:514-534`) and
`ScrubController.resolveGuideColor` (`ScrubController.ts:204`) are the same function with
different fallbacks. `Dialog.ts:158` and `JollyField.ts:419` then hand-roll the same
`getComputedStyle(...).getPropertyValue("--jolly-surface").trim() !== ""` probe.

`interaction/dragGhost.ts` already owns this concept properly (`copyTheme`, `themeTokenNames`,
with the best comment in the package explaining why one level of copying suffices). A single
`resolveThemeToken(host, name, fallback)` exported from `theme/` — next to `kFallback`, which
is where the fallbacks already live — is the canonical home.

---

## 9. `isPane` and `PaneDragDetail` are duplicated verbatim

- `isPane`: `Dock.ts:521` and `Floating.ts:440`, identical.
- `interface PaneDragDetail`: `DockLayout.ts:60` and `Floating.ts:36`, identical.

Both are the container layer's shared vocabulary and belong exported from `Pane.ts`. The
duplicated `PaneDragDetail` is the worse of the two: it is the *contract* of the
`jolly-pane-drag` event, and two hand-maintained copies of an event contract will drift.

---

## 10. `jolly-change` means two different things

`Tabs.#synchroniseSelection` (`Tabs.ts:118`) emits a bubbling, composed `jolly-change` with
`{ value: string }` through `emitContainerEvent`, while every `JollyField` emits `jolly-change`
with `JollyChangeDetail<TValue>` through `emitFieldEvent`. A `jolly-tabs` inside a pane that
also holds fields fires the *same event name* at the same listener with an unrelated meaning
and an unrelated detail shape — and `detailOf<T>` will happily cast it.

The public type is already called `JollyTabChangeDetail` (`containers/events.ts:20`), so the
intent to distinguish exists; only the wire name was left colliding. Rename to
`jolly-tab-change`.

---

## 11. Container events are stringly typed, and every listener casts

`emitContainerEvent(target, name: string, detail: TDetail)` (`containers/events.ts:24`)
accepts any string. Fifteen event names are spelled by hand at both emit and listen sites:

```
jolly-cancel  jolly-change  jolly-close  jolly-folder-drag  jolly-folder-reorder
jolly-layout-change  jolly-layout-dirty  jolly-move  jolly-move-end  jolly-pane-drag
jolly-pane-move  jolly-reorder  jolly-resize  jolly-resize-end  jolly-toggle
```

Every listener is therefore `(event: Event)` followed by an unchecked
`detailOf<SomeDetail>(event)` and a null guard — nine such casts in `src/`. `TDetail` is
inferred from the argument, so it constrains nothing; a typo in a name is a silent no-op, and
a wrong detail shape is a runtime surprise.

**Code judo.** One event map plus declaration merging:

```ts
export interface ContainerEventMap {
  "jolly-pane-drag": PaneDragDetail;
  "jolly-layout-dirty": undefined;
  // ...
}
export function emitContainerEvent<K extends keyof ContainerEventMap>(
  target: EventTarget, name: K, detail: ContainerEventMap[K]
): void;

declare global {
  interface HTMLElementEventMap extends {
    [K in keyof ContainerEventMap]: CustomEvent<ContainerEventMap[K]>
  } {}
}
```

`addEventListener("jolly-pane-drag", …)` then types `event.detail` directly and **most
`detailOf` call sites disappear**, along with their null branches. This is the change that
most improves the container layer's legibility per line touched.

---

## 12. `DockLayout` persists a geometry the window is not at

`#extract` (`DockLayout.ts:476`) appends the frame, calls `#refresh()` synchronously, then
defers the clamp:

```ts
this.#refresh();
void frame.updateComplete.then(() => {
  frame.clampToView();
  frame.raise();
});
```

Back in `onCommit` (`DockLayout.ts:319`), `#save()` runs immediately after `#extract`, calling
`#refresh()` again — still before `updateComplete` resolves. `clampToView` then mutates `x`/`y`
without emitting `jolly-layout-dirty` (`Floating.ts:222`). Net effect: **the snapshot written
to storage holds the pre-clamp position**, and nothing schedules a correction. Dragging a pane
out near a viewport edge and reloading restores it at the un-clamped coordinates.

The fix is to make the extraction atomic — clamp before reading, or `await` the frame before
`#refresh`/`#save` — rather than to add another dirty emit. Related smell in the same file:
`#read()` (`DockLayout.ts:684`) is named as a read but writes `#geometry` as a side effect
(`:701`), which is exactly the kind of thing the `#applying` reentrancy guard exists to
survive. Making it pure and updating the cache at an explicit call site gives that guard less
to protect.

---

## 13. `Rect` lives inside the overlay-painting module

`Dock.ts:26` imports `type { Rect } from "../interaction/dragOverlay.ts"` purely to describe a
rectangle, and `index.ts:88` re-exports the package's core geometry type from there. Meanwhile
`numeric/anchoredPosition.ts` and `numeric/clampToViewport.ts` are geometry/positioning code
filed under a folder that otherwise holds number formatting and expression evaluation.

Small, but it is the kind of misfiling that makes the folder tree stop predicting content —
which is the drift the review was asked about. `Rect` + the two positioning helpers belong in
one `geometry/` module that neither the overlay nor the numeric formatting layer owns.

---

## 14. Folder shape: the dispersion is mostly fine, with two exceptions

The `*.styles.ts` convention is consistent and worth keeping — `JollyField.styles.ts` (367),
`Dock.styles.ts` (320) and `ColorPicker.styles.ts` (297) fully justify it. But four of them are
pure ceremony and would be better inlined as `static styles = css\`…\``:

`Tab.styles.ts` (14), `Icon.styles.ts` (20), `Toolbar.styles.ts` (23), `Rail.styles.ts` (30).

`interaction/` (10 files) is the folder that has actually become a grab-bag: it holds three
unrelated concerns flat — pane/folder drag (`DragSession`, `dragOverlay`, `dragGhost`,
`dragStyles`, `dropIndex`), numeric scrub (`ScrubController`, `dragGuide`), and focus/popover
(`PopoverController`, `PointerFocusController`, `pointerModality`). The `drag*` prefix is doing
the job a directory should. Splitting into `interaction/drag/`, `interaction/scrub/` and moving
the focus trio next to `field/` would make the folder predict its contents again.

---

## 15. Smaller notes

- **`Pane.title` and `Dialog.title` shadow `HTMLElement.title`** (`Pane.ts:75`, `Dialog.ts:30`).
  This gives every pane a native browser tooltip of its own title on hover, and forces
  `headerGhost` callers to re-assign it by hand (`DockLayout.ts:245`, and the same fix-up
  comment duplicated at `Pane.ts:546` for `label`). Renaming to `heading`/`paneTitle` removes a
  native-property collision and both fix-ups.
- **`index.ts` (212 lines) has lost its ordering.** The colour exports sit between the drag
  exports and `ButtonGroup`; `PopoverController` and `DragSession` sit in the middle of the
  controls block. It is the public API surface, so it is the first place the drift is visible.
- **`field/predicates.ts`** — `splitPeerChips` is a two-branch slice used once. It earns its
  keep as a tested pure function; noting only that `isModified`'s default `equals = Object.is`
  parameter is never used (`JollyField.ts:126` always passes one).

---

## Verdict

No behavioural regression found, and the commenting discipline is genuinely above average.
But the package has drifted in a specific, diagnosable way: **policies that should exist once
are being re-implemented per element.** Persistence (§1), the numeric draft protocol (§4),
token resolution (§8), style injection (§7) and pointer-focus (§6) are five instances of the
same failure mode, and they are why adding a feature now means touching four files.

If only three things are done:

1. **§3 + §2** — extract `FolderListController` and give folders a real key. Deletes the worst
   magic in the package and takes `Pane.ts` from 782 to ~450 lines.
2. **§1** — one `PersistedState` controller. Deletes four copies of a fork and closes the
   `resetLayout` gap in §1a as a side effect.
3. **§11** — type the container event map. Cheapest change with the largest legibility payoff,
   and it makes §9 and §10 impossible to reintroduce.

§12 is the one item that is a latent defect rather than a maintainability cost, and is worth
fixing independently of any restructuring.
