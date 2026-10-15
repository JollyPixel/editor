# `jolly-theme-control`

`jolly-theme-control` renders a button group for light, dark and automatic
theme selection. It does not apply the theme to a scope.

```html
<jolly-theme-control label="Theme"></jolly-theme-control>
```

## Properties

```ts
interface ThemeControl {
  value: "light" | "dark" | "auto"; // property only, default "auto"
  label: string; // default "Theme"
}
```

## Events

```ts
interface ThemeControlEvents {
  "jolly-change": { value: ThemeMode; }; // value is updated first
}
```
