# `jolly-progress`

`jolly-progress` renders determinate or indeterminate progress.

```html
<jolly-progress value="37" max="100" label="Loading assets"></jolly-progress>
```

## Properties

```ts
interface Progress {
  value: number | null; // null: indeterminate
  max: number; // default 1
  label: string;
  valueText: string; // attribute value-text
  animated: boolean;
  completed: boolean;
}
```

- Rendering clamps a determinate value without changing the properties.
- Parts: `track`, `indicator`.
