// Import Third-party Dependencies
import "reflect-metadata";

export function Property(): PropertyDecorator {
  return function work(
    object: Object,
    propertyName: string | symbol
  ): void {
    console.log({ object, propertyName });
  };
}
