# Network

`@jolly-pixel/three/network` connects Three.js helpers to
`@jolly-pixel/network`. Install that optional peer dependency before using this
entry point.

- [Peer frustums](./frustums.md) publish a camera or `Object3D` pose and draw
  remote poses.
- [Peer selection and hover](./selection.md) publish the local state of a
  `MeshHighlight` and apply remote state to its `peers`.

The entry point also exports the presence value types and their decoders:

```ts
decodePeerFrustumPose(value: unknown): PeerFrustumPose | undefined;
decodePeerObjectId(value: unknown): string | null | undefined;
```

Malformed values return `undefined`. A valid `null` selection or hover means
that the peer cleared that state.
