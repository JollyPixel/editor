# Network

`@jolly-pixel/three/network` connects Three.js helpers to
`@jolly-pixel/network`. Install that optional peer dependency before using this
entry point.

- [Peer frustums](./frustums.md) publish a camera or `Object3D` pose and draw
  remote poses.
- [Peer selection and hover](./selection.md) publish a local
  `SelectionManager` and update the remote peer registries.

The entry point also exports the presence value types and their decoders:

```ts
decodePeerFrustumPose(value: unknown): PeerFrustumPose | undefined;
decodePeerSelectionId(value: unknown): string | null | undefined;
decodePeerHoverId(value: unknown): string | null | undefined;
```

Malformed values return `undefined`. A valid `null` selection or hover means
that the peer cleared that state.
