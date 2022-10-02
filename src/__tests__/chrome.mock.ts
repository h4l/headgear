type chrome = typeof window.chrome;

export function mockLocalStorage(): jest.Mocked<
  Partial<chrome.storage.LocalStorageArea>
> {
  const data: { [key: string]: any } = {};
  const local: jest.Mocked<Partial<chrome.storage.LocalStorageArea>> = {
    get: jest.fn(
      async (
        keys?: string | string[] | { [key: string]: any } | null
      ): Promise<{ [key: string]: any }> => {
        const result = !keys
          ? { ...data }
          : typeof keys === "string"
          ? { [keys]: undefined }
          : Array.isArray(keys)
          ? Object.fromEntries(keys.map((k) => [k, undefined]))
          : {};
        for (const key in result) {
          if (key in data) {
            result[key] = data[key];
          }
        }
        return result;
      }
    ),
    set: jest.fn(async (items: { [key: string]: any }): Promise<void> => {
      for (const key in items) {
        data[key] = items[key];
      }
    }),
  };
  return local;
}

export function mockOnMessage(): jest.Mocked<
  Partial<chrome.runtime.ExtensionMessageEvent>
> {
  return {
    addListener: jest.fn(),
  };
}

export function mockChrome(): chrome {
  const storage: Partial<typeof chrome.storage> = {
    local: mockLocalStorage() as chrome.storage.LocalStorageArea,
  };
  const onMessage = mockOnMessage();
  const _chrome: Partial<chrome> = {
    storage: storage as typeof chrome.storage,
    runtime: {
      onMessage,
    } as typeof chrome.runtime,
  };
  return _chrome as chrome;
}
