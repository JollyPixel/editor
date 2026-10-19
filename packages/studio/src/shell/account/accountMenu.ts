// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type {
  ContextMenuEntry,
  ContextMenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { roleLabel } from "../../accounts/UsersTreeModel.ts";

// CONSTANTS
const kOwnerLabel = "Owner";
const kActions: readonly ContextMenuEntry[] = [
  {
    id: "settings",
    label: "Settings",
    icon: "settings"
  },
  "separator",
  {
    id: "sign-out",
    label: "Sign out",
    icon: "sign-out",
    intent: "danger"
  }
];

export function accountMenu(
  account: Account
): ContextMenuEntry[] {
  const role = account.owner ? kOwnerLabel : roleLabel(account.role);
  const header: ContextMenuItem = {
    id: "account",
    label: `${account.username} · ${role}`,
    disabled: true,
    ...(account.owner ? { icon: "crown" } : {})
  };

  return [
    header,
    "separator",
    ...kActions
  ];
}
