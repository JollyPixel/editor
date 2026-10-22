// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import type { SourceSubscriber } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  REMOTE_STATE_CHANGE,
  type RemoteState
} from "../api/RemoteState.ts";
import { ChangeController } from "./ChangeController.ts";

export class RemoteStateController<
  TState extends RemoteState
> extends ChangeController<TState> {
  constructor(
    host: ReactiveControllerHost,
    subscribe?: SourceSubscriber<TState>
  ) {
    super(host, REMOTE_STATE_CHANGE, subscribe);
  }

  error(): TemplateResult | typeof nothing {
    const message = this.current?.error ?? null;

    return message === null ?
      nothing :
      html`<p class="error" role="alert">${message}</p>`;
  }
}
