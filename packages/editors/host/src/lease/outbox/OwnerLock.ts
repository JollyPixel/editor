// CONSTANTS
const kLockPrefix = "jolly-pixel:pending-changes:";

interface OwnerLockOptions {
  id: string;
  locks: LockManager;
  release: () => void;
}

export class OwnerLock {
  static async acquire(
    locks: LockManager
  ): Promise<OwnerLock> {
    const id = crypto.randomUUID();
    const held = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    locks.request(kLockPrefix + id, () => {
      held.resolve();

      return released.promise;
    }).catch(held.reject);
    await held.promise;

    return new OwnerLock({
      id,
      locks,
      release: released.resolve
    });
  }

  readonly id: string;
  readonly #locks: LockManager;
  readonly #release: () => void;

  constructor(
    options: OwnerLockOptions
  ) {
    this.id = options.id;
    this.#locks = options.locks;
    this.#release = options.release;
  }

  async liveOwners(): Promise<Set<string>> {
    const { held = [] } = await this.#locks.query();

    return new Set(
      held.flatMap(({ name }) => (
        name?.startsWith(kLockPrefix) ?
          [name.slice(kLockPrefix.length)] :
          []
      ))
    );
  }

  release(): void {
    this.#release();
  }
}
