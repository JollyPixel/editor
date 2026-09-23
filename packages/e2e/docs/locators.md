# Locators

Locators for `@jolly-pixel/ui` components, matched on `jolly-*` tag names and
ARIA roles.

| Function | Matches |
|---|---|
| `dialog(page, heading)` | the open `jolly-dialog` whose banner shows `heading` |
| `titledDialog(page, title)` | the open `jolly-dialog` with an editable heading set to `title` |
| `dialogTitle(scope)` | the editable heading textbox |
| `textField(scope, label)` | the textbox of a `jolly-text` showing `label` |
| `selectField(scope, label)` | the combobox of a `jolly-select` |
| `checkboxField(scope, label)` | the checkbox of a `jolly-checkbox` |
| `buttonGroup(scope, label)` | the radiogroup of a `jolly-button-group` |
| `treeRow(page, name)` | a `treeitem` holding the exact text `name` |
| `fieldRow(page, tag, state)` | the `tag` field in the row marked `data-state="<state>"` |

`jolly-dialog` has no accessible name, and field labels are not associated
with their inputs, so these filter by visible text. A tree row's accessible
name also includes its action labels, so `treeRow` matches on the text node.
