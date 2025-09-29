/**
 * Interface for input controls that maintain state and need periodic updates using eg. requestAnimationFrame.
 */
export interface InputUpdateable {
  reset(): void;
  update(): void;
}

/**
 * Interface for input controls that need to register/unregister DOM event listeners.
 */
export interface InputConnectable {
  connect?(): void;
  disconnect?(): void;
}

export interface InputControl extends InputUpdateable, InputConnectable {}
