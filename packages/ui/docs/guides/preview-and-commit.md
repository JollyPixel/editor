# Preview and commit

A drag on a slider emits many `jolly-input` events and one `jolly-change`.
Show each step, then record the edit once: one undo step, one network command.

## 1. Tell the two apart

`FieldBinding` passes `last` to `write()`: `false` for `jolly-input`, `true`
for `jolly-change`.

```ts
#opacity = new FieldBinding<number>(this, {
  read: () => this.layer.opacity,
  write: (value, last) => {
    this.layer.opacity = value;
    if (last) {
      this.settings.save();
    }
  }
});
```

This is enough when writing the model is cheap and nothing else listens to
it. Each step updates the model, and only the commit persists.

## 2. Preview, then commit once

When a write goes through history or reaches other peers, keep the steps out
of the document:

```ts
#opacity = new FieldBinding<number>(this, {
  read: () => this.layer.preview?.opacity ?? this.layer.opacity,
  write: (value, last) => {
    if (!last) {
      this.layer.preview = { opacity: value };

      return;
    }

    this.layer.preview = null;
    this.history.execute(new SetLayerOpacity(this.layer.id, value));
  }
});
```

- The preview is local state that the view draws over the document. It is
  never undone and never sent.
- The commit is the only write to the document, so a whole drag is one undo
  step.
- `read()` returns the preview while it exists, so the field and the view show
  the same value.
- Bind both `input` and `commit` in the template. With `commit` alone, the
  field emits steps nobody hears, and the preview never shows.

## 3. Skip commits that change nothing

A commit does not promise a new value. A source that rounds, such as a
position snapped to the grid, often receives a value that rounds to the one
the model holds. Compare before recording:

```ts
write: (value, last) => {
  const next = snap(value);
  if (!last || equals(next, this.block.position)) {
    return;
  }

  this.history.execute(new MoveBlock(this.block.id, next));
}
```

Without the check, the undo stack fills with steps that do nothing.

## 4. Text and choices

- `jolly-text` emits `jolly-input` on each keystroke. Bind `commit` alone for
  a name, or every letter becomes an edit.
- `jolly-select`, `jolly-checkbox` and `jolly-toggle` emit only
  `jolly-change`.

## 5. Show a live preview to peers

Peers should see a drag while it happens, without receiving one document
command per step. Send the preview through the application's presence
channel from the `!last` branch, and clear it with the commit:

```ts
write: (value, last) => {
  this.livePreview.send(last ? null : {
    layer: this.layer.id,
    value
  });
  if (last) {
    this.history.execute(new SetLayerOpacity(this.layer.id, value));
  }
}
```

The document command carries the final value, so a peer that missed a preview
still ends up in the same state.

## Without `FieldBinding`

The two events carry the same detail. Listen to each:

```ts
html`
  <jolly-slider
    .value=${this.layer.preview?.opacity ?? this.layer.opacity}
    @jolly-input=${(event: CustomEvent<JollyChangeDetail<number>>) => {
      this.preview(event.detail.value);
    }}
    @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
      this.commit(event.detail.value);
    }}
  ></jolly-slider>
`;
```

Field events cannot be cancelled. To refuse an edit, do not write it: the next
render shows the value the model kept.
