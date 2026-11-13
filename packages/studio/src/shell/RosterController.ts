// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import type { AccountsRoster } from "@jolly-pixel/accounts";
import { SubscriptionController } from "@jolly-pixel/ui";

export class RosterController extends SubscriptionController<AccountsRoster> {
  constructor(
    host: ReactiveControllerHost
  ) {
    super(host, (roster) => {
      function repaint(): void {
        host.requestUpdate();
      }
      roster.on("change", repaint);

      return [
        () => roster.off("change", repaint)
      ];
    });
  }
}
