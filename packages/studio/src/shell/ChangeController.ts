// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  SubscriptionController,
  type SourceSubscriber
} from "@jolly-pixel/ui";

export class ChangeController<
  TSource extends EventTarget
> extends SubscriptionController<TSource> {
  constructor(
    host: ReactiveControllerHost,
    event: string,
    subscribe: SourceSubscriber<TSource> = () => []
  ) {
    super(host, (source) => {
      function repaint(): void {
        host.requestUpdate();
      }
      source.addEventListener(event, repaint);

      return [
        () => source.removeEventListener(event, repaint),
        ...subscribe(source)
      ];
    });
  }
}
