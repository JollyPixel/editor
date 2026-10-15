# `jolly-monitor`

`jolly-monitor` renders a read-only label and value row. It does not poll:
the application assigns each new value.

```html
<jolly-monitor label="Draw calls"></jolly-monitor>
```

## Properties

```ts
interface MonitorElement {
  label: string;
  value: number | string;
  format: ((value: number) => string) | undefined; // numbers only
}
```
