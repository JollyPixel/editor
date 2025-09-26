// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ActorComponent } from "../src/index.js";
import { createActor } from "./mocks.js";

describe("ActorComponent", () => {
  test("should register component to actor and add to components to be started", () => {
    const fakeActor = createActor();

    const component = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent"
    });

    assert.deepEqual(fakeActor.components, [component]);
    assert.deepEqual(fakeActor.gameInstance.scene.componentsToBeStarted, [component]);
    assert.equal(component.actor, fakeActor);
    assert.equal(component.typeName, "TestComponent");
    assert.equal(component.pendingForDestruction, false);
  });

  test("should handle multiple components on same actor", () => {
    const fakeActor = createActor();

    const component1 = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent1"
    });

    const component2 = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent2"
    });

    assert.deepEqual(fakeActor.components, [component1, component2]);
    assert.deepEqual(fakeActor.gameInstance.scene.componentsToBeStarted, [component1, component2]);
  });

  test("should not be destroyed initially", () => {
    const fakeActor = createActor();

    const component = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent"
    });

    assert.equal(component.isDestroyed(), false);
  });

  test("should remove component from actor on destroy", () => {
    const fakeActor = createActor();

    const component = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent"
    });

    assert.equal(fakeActor.components.length, 1);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 1);

    component.destroy();

    assert.equal(fakeActor.components.length, 0);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 0);
  });

  test("should handle destroy when multiple components exist", () => {
    const fakeActor = createActor();

    const component1 = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent1"
    });

    const component2 = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent2"
    });

    assert.equal(fakeActor.components.length, 2);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 2);

    component1.destroy();

    assert.equal(fakeActor.components.length, 1);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 1);
    assert.equal(fakeActor.components[0], component2);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted[0], component2);
  });

  test("should handle destroy on component not in componentsToBeStarted", () => {
    const fakeActor = createActor();

    const component = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent"
    });

    // Manually remove from componentsToBeStarted to simulate started component
    const startIndex = fakeActor.gameInstance.scene.componentsToBeStarted.indexOf(component);
    fakeActor.gameInstance.scene.componentsToBeStarted.splice(startIndex, 1);

    assert.equal(fakeActor.components.length, 1);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 0);

    component.destroy();

    assert.equal(fakeActor.components.length, 0);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 0);
  });

  test("should handle destroy on component not in actor components", () => {
    const fakeActor = createActor();

    const component = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent"
    });

    // Manually remove from actor components
    const componentIndex = fakeActor.components.indexOf(component);
    fakeActor.components.splice(componentIndex, 1);

    assert.equal(fakeActor.components.length, 0);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 1);

    component.destroy();

    assert.equal(fakeActor.components.length, 0);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 0);
  });

  test("should handle destroy on already destroyed component", () => {
    const fakeActor = createActor();

    const component = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "TestComponent"
    });

    component.destroy();
    assert.equal(fakeActor.components.length, 0);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 0);

    // Should not throw or cause issues
    component.destroy();
    assert.equal(fakeActor.components.length, 0);
    assert.equal(fakeActor.gameInstance.scene.componentsToBeStarted.length, 0);
  });

  test("should handle different component types", () => {
    const fakeActor = createActor();

    const scriptComponent = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "ScriptBehavior"
    });

    const cameraComponent = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "Camera"
    });

    const customComponent = new ActorComponent({
      // @ts-expect-error
      actor: fakeActor,
      typeName: "CustomType"
    });

    assert.equal(scriptComponent.typeName, "ScriptBehavior");
    assert.equal(cameraComponent.typeName, "Camera");
    assert.equal(customComponent.typeName, "CustomType");
  });
});
