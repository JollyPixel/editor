---
layout: home

hero:
  name: "JollyPixel"
  text: "The collaborative 3D HTML5 game maker"
  tagline: Build 3D games in your browser with Three.js
  image:
    src: https://avatars.githubusercontent.com/u/209688499
    alt: JollyPixel
  actions:
    - theme: brand
      text: Get Started
      link: /engine/docs/guides/hello-world
    - theme: alt
      text: Engine reference
      link: /engine/README
    - theme: alt
      text: View on GitHub
      link: https://github.com/JollyPixel/editor

features:
  - title: ECS Architecture
    details: Actors, Components and Scenes on top of Three.js, with Godot-like signals and decorator-driven behavior scripts.
    link: /engine/README
  - title: Frame Loop
    details: The game loop, clock, frame budget and scheduler that drive every runtime, split out of the engine.
    link: /loop/README
  - title: Input
    details: A unified input manager for mouse, keyboard, gamepad and touchpad, with device auto-detection and action queries.
    link: /controls/README
  - title: Voxel Renderer
    details: Chunked voxel worlds with layers, tileset atlases, custom block shapes, collisions and server-authoritative sync.
    link: /voxel-renderer/README
  - title: Pixel Drawing
    details: A pixel-art canvas with brush, fill, line and selection tools, undo/redo history, UV mapping and live collaboration.
    link: /pixel-draw-renderer/README
  - title: Assets
    details: Content-addressed asset records, pluggable sources and an event-sourced asset server backed by the event store.
    link: /asset/README
  - title: Networking
    details: Transport-agnostic client, server, rooms and extensions, with role-based rights and last-write-wins conflict resolution.
    link: /network/README
  - title: Editor UI
    details: Web-component controls, panes, docking layouts, theming tokens and peer presence for building editor interfaces.
    link: /ui/README
---
