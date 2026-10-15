# `jolly-button`

`jolly-button` renders a slotted action button. Activation emits the native
`click` event.

```html
<jolly-button icon="revert" variant="accent">Reset</jolly-button>
<jolly-button icon="close" label="Close" icon-only></jolly-button>
```

## Properties

```ts
interface Button {
  icon: IconName | undefined;
  variant: ButtonVariant; // default "default"
  disabled: boolean;
  label: string; // accessible name
  iconOnly: boolean; // attribute icon-only
}

type ButtonVariant = "default" | "accent" | "danger";
```

- The default slot holds the visible content.
- `label` names an icon-only button but shows no tooltip. Add the global
  `title` attribute for one.
