# `jolly-button`

`jolly-button` renders a slotted action button.
The root entry point exports `Button` and `ButtonVariant`.

```html
<jolly-button icon="revert" variant="accent">Reset</jolly-button>
<jolly-button icon="close" label="Close" icon-only></jolly-button>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `icon` | `icon` | `IconName \| undefined` | `undefined` |
| `variant` | `variant` | `"default" \| "accent" \| "danger"` | `"default"` |
| `disabled` | `disabled` | `boolean` | `false` |
| `label` | `label` | `string` | `""` |
| `iconOnly` | `icon-only` | `boolean` | `false` |

The default slot supplies visible button content. Set `label` when an icon-only
button has no visible text. Activation emits the native `click` event.
