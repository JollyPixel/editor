# EditorStore

Base class for an editor's state slices: an `@openally/emitt` `Emitter` with
one addition.

```ts
class EditorStore<TEvents extends EventMap> extends Emitter<TEvents> {
  watch<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: TEvents[TEvent]
  ): () => void;
}
```

`watch` subscribes like `on` and returns the matching unsubscribe, so a
component can collect its subscriptions and drop them together.

```ts
type SelectionEvents = {
  change: (id: string | null) => void;
};

class SelectionStore extends EditorStore<SelectionEvents> {}

const unwatch = store.watch("change", (id) => render(id));
unwatch();
```
