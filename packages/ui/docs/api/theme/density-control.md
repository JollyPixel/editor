# `jolly-density-control`

`jolly-density-control` renders a select of the three densities. It does not
apply the density to a scope.

```html
<jolly-density-control label="Density"></jolly-density-control>
```

## Properties

```ts
interface DensityControl {
  value: "compact" | "default" | "comfortable"; // property only, default "default"
  label: string; // default "Density"
}
```

## Events

```ts
interface DensityControlEvents {
  "jolly-change": { value: Density; }; // value is updated first
}
```
