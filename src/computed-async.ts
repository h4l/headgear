import { Signal, computed, effect, signal } from "@preact/signals";

import { assert } from "./assert";

type SignalValuesObject<T extends Record<string, Signal<unknown>>> = {
  [Property in keyof T]: T[Property] extends Signal<infer U> ? U : never;
};

type ValueOrError<T> = { value: T } | { error: unknown };

export class Superseded extends Error {}

/**
 * Create a Signal that is updated with the result of an async function.
 *
 * The compute() function is called every time one of the input signals changes.
 *
 * The returned signal first holds the initial value, and thereafter the result
 * of the most-recent resolved promise returned by compute() that wasn't
 * superseded by a subsequent compute() call.
 *
 * The superseded option of compute() is resolved with true when another
 * compute() call has begun. This indicates that the result of the existing
 * compute() call will not be used, so the compute() can abort any remaining
 * work by throwing `Superseded`, which is caught and ignored.
 */
export function computedAsync<
  T extends Record<string, Signal<unknown>>,
  U
>(options: {
  signals: T;
  compute: (options: {
    signalValues: SignalValuesObject<T>;
    superseded: Promise<boolean>;
  }) => Promise<U>;
  initial: U;
}): Signal<U> {
  const signals = options.signals;
  const state = signal<ValueOrError<U>>({ value: options.initial });
  const sentinel = {};
  let onNextSuperseded: () => void | undefined;

  effect(() => {
    onNextSuperseded && onNextSuperseded();

    const signalValues = {} as Record<string, unknown>;
    for (const [name, signal] of Object.entries(signals))
      signalValues[name] = signal.value;
    let onThisNotSuperseded: undefined | (() => void);
    const superseded = new Promise<boolean>((resolve) => {
      onThisNotSuperseded = () => resolve(false);
      onNextSuperseded = () => resolve(true);
    });
    assert(onThisNotSuperseded);
    const nextValuePromise = options.compute({
      signalValues: signalValues as SignalValuesObject<T>,
      superseded,
    });
    (async () => {
      try {
        const nextValue = await Promise.race([superseded, nextValuePromise]);
        const isSuperseded =
          (await Promise.race([superseded, sentinel])) !== sentinel;

        // If another async computation started we ignore this result.
        if (isSuperseded) {
          nextValuePromise.catch((e) => {
            if (e instanceof Superseded) return;
            console.error(
              `computedAsync(): superseded computation from ` +
                `${options.compute} failed`,
              e
            );
          });
          return;
        }

        onThisNotSuperseded();
        state.value = { value: nextValue as U };
      } catch (e) {
        onThisNotSuperseded();
        state.value = { error: e };
      }
    })();
  });

  // We use computed() for its ability to throw errors when its state value is
  // accessed.
  return computed(() => {
    const value = state.value;
    if ("error" in value) {
      throw value.error;
    }
    return value.value;
  });
}

export function serialiseExecutions<T extends unknown[], U>(
  fn: (...args: T) => Promise<U>
): (...args: T) => Promise<U> {
  let ongoingExecution: Promise<number> | number = -1;
  let nextWaiterId = 0;
  const waiters: Map<number, () => void> = new Map();

  return async (...args: T): Promise<U> => {
    const waiterId = nextWaiterId++;
    const preWaitExecutionId: number | undefined = await Promise.race([
      ongoingExecution,
      undefined,
    ]);
    if (preWaitExecutionId !== waiterId - 1) {
      const accessPermitted = new Promise<void>((resolve) => {
        waiters.set(waiterId, resolve);
      });
      await accessPermitted;
      waiters.delete(waiterId);
    }

    const lastExecution = ongoingExecution;
    let resolveOngoingExecution: undefined | ((id: number) => void);
    ongoingExecution = new Promise((resolve) => {
      resolveOngoingExecution = resolve;
    });
    assert(resolveOngoingExecution);
    assert((await Promise.race([lastExecution, undefined])) === waiterId - 1);

    try {
      return await fn(...args);
    } finally {
      resolveOngoingExecution(waiterId);
      if (waiters.size) {
        const unblockNextWaiter = waiters.get(waiterId + 1);
        assert(unblockNextWaiter);
        unblockNextWaiter();
      }
    }
  };
}
