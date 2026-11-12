// Import Internal Dependencies
import type { ChangeReceipts } from "./ChangeReceipts.ts";

export interface LocalEdits<TCommand> {
  readonly receipts: Pick<ChangeReceipts<object>, "subscribe">;

  applyStep(
    command: TCommand
  ): object | null;
}
