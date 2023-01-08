import { signal } from "@preact/signals";
import { waitFor } from "@testing-library/preact";

import {
  Superseded,
  computedAsync,
  serialiseExecutions,
} from "../computed-async";

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

describe("serialiseExecutions()", () => {
  describe("successful calls", () => {
    let fnCallEvents: { event: "started" | "stopped"; i: number }[] = [];
    let serialisedFn: typeof fn;

    const fn = async (i: number) => {
      fnCallEvents.push({ event: "started", i });
      await new Promise((resolve) => setTimeout(resolve, 50));
      fnCallEvents.push({ event: "stopped", i });
      return `${i}`;
    };

    beforeEach(() => {
      fnCallEvents = [];
      serialisedFn = serialiseExecutions(fn);
    });

    test("non-overlapping calls", async () => {
      expect(await serialisedFn(0)).toBe("0");
      expect(await serialisedFn(1)).toBe("1");
      expect(await serialisedFn(2)).toBe("2");

      expect(fnCallEvents).toEqual([
        { event: "started", i: 0 },
        { event: "stopped", i: 0 },
        { event: "started", i: 1 },
        { event: "stopped", i: 1 },
        { event: "started", i: 2 },
        { event: "stopped", i: 2 },
      ]);
    });

    test("overlapping calls", async () => {
      const resultPromises = [0, 1, 2].map((i) => serialisedFn(i));
      const results = await Promise.all(resultPromises);
      expect(results).toEqual(["0", "1", "2"]);
      expect(fnCallEvents).toEqual([
        { event: "started", i: 0 },
        { event: "stopped", i: 0 },
        { event: "started", i: 1 },
        { event: "stopped", i: 1 },
        { event: "started", i: 2 },
        { event: "stopped", i: 2 },
      ]);
    });
  });

  describe("failing calls", () => {
    let fnCallEvents: { event: "started" | "stopped"; i: number }[] = [];
    let serialisedFn: typeof fn;

    const fn = async (i: number) => {
      fnCallEvents.push({ event: "started", i });
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        throw new Error(`${i} failed`);
      } finally {
        fnCallEvents.push({ event: "stopped", i });
      }
    };

    beforeEach(() => {
      fnCallEvents = [];
      serialisedFn = serialiseExecutions(fn);
    });

    test("non-overlapping calls", async () => {
      await expect(serialisedFn(0)).rejects.toThrow("0 failed");
      await expect(serialisedFn(1)).rejects.toThrow("1 failed");
      await expect(serialisedFn(2)).rejects.toThrow("2 failed");

      expect(fnCallEvents).toEqual([
        { event: "started", i: 0 },
        { event: "stopped", i: 0 },
        { event: "started", i: 1 },
        { event: "stopped", i: 1 },
        { event: "started", i: 2 },
        { event: "stopped", i: 2 },
      ]);
    });

    test("overlapping calls", async () => {
      const resultPromises = [0, 1, 2].map((i) => serialisedFn(i));
      const results = await Promise.allSettled(resultPromises);
      expect(
        results.map((r) => r.status === "rejected" && `${r.reason.message}`)
      ).toEqual(["0 failed", "1 failed", "2 failed"]);
      expect(fnCallEvents).toEqual([
        { event: "started", i: 0 },
        { event: "stopped", i: 0 },
        { event: "started", i: 1 },
        { event: "stopped", i: 1 },
        { event: "started", i: 2 },
        { event: "stopped", i: 2 },
      ]);
    });
  });
});
