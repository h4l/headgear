class AssertionError extends Error {
  constructor(options: { message?: string } = {}) {
    super(options.message);
  }
}

export function assert(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new AssertionError({
      message: message || `assert(): value is not truthy: ${value}`,
    });
  }
}

export function assertNever(value: never): never {
  throw new AssertionError({ message: `unexpected value: ${value}` });
}
