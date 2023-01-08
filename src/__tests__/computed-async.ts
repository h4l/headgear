import { signal } from "@preact/signals";
import { waitFor } from "@testing-library/preact";

import { Superseded, computedAsync } from "../computed-async";

describe("computedAsync()", () => {
  test("returns state that updates asynchronously as source states change", async () => {
    const src1 = signal<number>(42);
    const src2 = signal<string>("abc");

    const result = computedAsync({
      signals: { src1, src2 },
      initial: "initial value",
      async compute({ signalValues: { src1, src2 } }) {
        return `${src1}:${src2}`;
      },
    });

    expect(result.value).toBe("initial value");

    await waitFor(async () => {
      expect(result.value).toBe("42:abc");
    });

    src1.value = 12;
    // value hasn't updated yet
    expect(result.value).toBe("42:abc");
    // But will update asynchronously
    await waitFor(async () => {
      expect(result.value).toBe("12:abc");
    });
  });

  test("accessing signal.value after failed compute() call throws the error", async () => {
    const src1 = signal<number>(42);

    const result = computedAsync({
      signals: { src1 },
      initial: "initial value",
      async compute({}) {
        throw new Error("oops");
      },
    });

    await waitFor(async () => {
      expect(() => result.value).toThrow("oops");
    });
  });

  test("superseded compute() calls are notified and ignored", async () => {
    const src1 = signal<number>(0);
    const computeCalls: number[] = [];
    const supersededCalls: number[] = [];
    const resultStates: string[] = [];
    const result = computedAsync({
      signals: { src1 },
      initial: "initial value",
      async compute({ signalValues: { src1 }, superseded }) {
        computeCalls.push(src1);
        await Promise.race([
          superseded,
          new Promise((resolve) => setTimeout(resolve, 50)),
        ]);
        if ((await Promise.race([superseded, undefined])) === true) {
          supersededCalls.push(src1);
          throw new Superseded();
        }
        return `${src1}`;
      },
    });
    result.subscribe((value) => {
      resultStates.push(value);
    });

    for (const i of [1, 2, 3]) {
      src1.value = i;
    }

    await waitFor(async () => {
      expect(result.value).toBe("3");
    });
    expect(computeCalls).toEqual([0, 1, 2, 3]);
    expect(supersededCalls).toEqual([0, 1, 2]);
    expect(resultStates).toEqual(["initial value", "3"]);
  });
});
