// Import Internal Dependencies
import type { NetworkCommandHeader } from "../sync/types.ts";

export interface CommandReconciler<
  TCommand extends NetworkCommandHeader
> {
  keys(
    command: TCommand
  ): readonly string[] | null;

  narrow(
    command: TCommand,
    keep: readonly number[]
  ): TCommand | null;

  revert(
    pending: readonly TCommand[]
  ): boolean;

  replay(
    command: TCommand
  ): boolean;
}
