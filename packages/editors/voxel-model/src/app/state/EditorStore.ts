// Import Third-party Dependencies
import {
  Emitter,
  type EventMap
} from "@openally/emitt";

export class EditorStore<
  TEvents extends EventMap
> extends Emitter<TEvents> {
  watch<TEvent extends keyof TEvents>(
    event: TEvent,
    listener: TEvents[TEvent]
  ): () => void {
    this.on(event, listener);

    return () => {
      this.off(event, listener);
    };
  }
}
