/* eslint @typescript-eslint/no-explicit-any: 0 */
import { assert } from "../assert";

type chrome = typeof window.chrome;

export class MockStorageArea
  implements jest.Mocked<chrome.storage.StorageArea>
{
  readonly data: { [key: string]: unknown } = {};
  get = jest.fn<any, any>(
    async (
      keys?: string | string[] | { [key: string]: any } | null
    ): Promise<{ [key: string]: any }> => {
      assert(
        keys === undefined ||
          typeof keys === "string" ||
          Array.isArray(keys) ||
          typeof keys === "object"
      );
      const result = !keys
        ? { ...this.data }
        : typeof keys === "string"
        ? { [keys]: undefined }
        : Array.isArray(keys)
        ? Object.fromEntries(keys.map((k) => [k, undefined]))
        : {};
      for (const key in result) {
        if (key in this.data) {
          result[key] = this.data[key];
        }
      }
      return result;
    }
  );

  set = jest.fn<any, any>(
    async (
      items: { [key: string]: any },
      callback?: unknown
    ): Promise<void> => {
      assert(callback === undefined);
      for (const key in items) {
        this.data[key] = items[key];
      }
    }
  );

  getBytesInUse = jest.fn<any, any>((): never => {
    throw new Error("Method not implemented.");
  });
  clear = jest.fn<any, any>((): never => {
    throw new Error("Method not implemented.");
  });
  remove = jest.fn<any, any>((): never => {
    throw new Error("Method not implemented.");
  });
  setAccessLevel = jest.fn<any, any>((): never => {
    throw new Error("Method not implemented.");
  });
  get onChanged(): chrome.storage.StorageAreaChangedEvent {
    throw new Error("Property not implemented");
  }
}

export class MockSyncStorageArea
  extends MockStorageArea
  implements chrome.storage.SyncStorageArea
{
  MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE = Number.POSITIVE_INFINITY;
  QUOTA_BYTES = Number.POSITIVE_INFINITY;
  QUOTA_BYTES_PER_ITEM = Number.POSITIVE_INFINITY;
  MAX_ITEMS = Number.POSITIVE_INFINITY;
  MAX_WRITE_OPERATIONS_PER_HOUR = Number.POSITIVE_INFINITY;
  MAX_WRITE_OPERATIONS_PER_MINUTE = Number.POSITIVE_INFINITY;
}

export class MockLocalStorageArea
  extends MockStorageArea
  implements chrome.storage.LocalStorageArea
{
  QUOTA_BYTES = Number.POSITIVE_INFINITY;
}

export function mockOnMessage(): jest.Mocked<
  Partial<chrome.runtime.ExtensionMessageEvent>
> {
  return {
    addListener: jest.fn(),
  };
}

export class MockEvent<T extends (...args: any) => void>
  implements jest.Mocked<chrome.events.Event<T>>
{
  listeners: Array<T> = [];
  addListener = jest.fn((callback: T): void => {
    this.listeners.push(callback);
  });
  callListeners(...args: Parameters<T>) {
    for (const listener of this.listeners) {
      listener(...Array.from(args));
    }
  }
  getRules = jest.fn<void, any>((): void => {
    throw new Error("Method not implemented.");
  });
  hasListener = jest.fn<boolean, any>((): boolean => {
    throw new Error("Method not implemented.");
  });
  removeRules = jest.fn<void, any>((): void => {
    throw new Error("Method not implemented.");
  });
  addRules = jest.fn<void, any>((): void => {
    throw new Error("Method not implemented.");
  });
  removeListener = jest.fn<void, any>((): void => {
    throw new Error("Method not implemented.");
  });
  hasListeners = jest.fn((): boolean => {
    throw new Error("Method not implemented.");
  });
}

type ExtensionMessageEventCallback = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => void;

class MockExtensionMessageEvent
  extends MockEvent<ExtensionMessageEventCallback>
  implements chrome.runtime.ExtensionMessageEvent
{
  sender: chrome.runtime.MessageSender = Object.freeze({});
  sendMessage: typeof chrome.runtime.sendMessage<any, any>;

  constructor() {
    super();

    /**
     * An a partial implementation of chrome.runtime.sendMessage - just the
     * (message: any) => Promise<any> signature. The implementation enforces the
     * Chrome behaviour, which is to only allow values to be returned via the
     * sendResponse() callback provided to the listener, and the listener has to
     * return `true` synchronously. Otherwise values are ignored.
     */
    this.sendMessage = async (
      message: any,
      ...__otherArgs: any[]
    ): Promise<any> => {
      if (__otherArgs.length !== 0) {
        throw new TypeError(
          "The only signature implemented is function sendMessage<M = any, R = any>(message: M): Promise<R> "
        );
      }

      const asyncResults = this.listeners
        .map((listener): Promise<unknown> | undefined => {
          let resolve: ((result?: unknown) => void) | undefined;
          let syncListenerResult: unknown;
          const asyncListenerResult = new Promise((_resolve) => {
            resolve = _resolve;
            syncListenerResult = listener(message, this.sender, resolve);
          });
          if (syncListenerResult === true) {
            return asyncListenerResult;
          } else if (
            syncListenerResult === false ||
            syncListenerResult === undefined
          ) {
            resolve && resolve(); // async result not used
            return undefined;
          }
          throw new TypeError(
            "ExtensionMessageEvent listener synchronously returned unexpected " +
              "value. Expected true, false or undefined but got: " +
              `${syncListenerResult}`
          );
        })
        .filter((x): x is Promise<unknown> => x !== undefined);

      if (asyncResults.length === 0) {
        return undefined;
      }
      return Promise.race(asyncResults);
    };
  }
}

export function mockExtensionConnectEvent(): MockEvent<
  (port: chrome.runtime.Port) => void
> {
  return new MockEvent();
}

export class MockPort implements jest.Mocked<chrome.runtime.Port> {
  name: string;
  sender?: chrome.runtime.MessageSender | undefined;
  constructor(name: string, sender?: chrome.runtime.MessageSender | undefined) {
    this.name = name;
    this.sender = sender;
  }
  onMessage: MockEvent<(message: any, port: chrome.runtime.Port) => void> =
    new MockEvent();
  onDisconnect: MockEvent<(port: chrome.runtime.Port) => void> =
    new MockEvent();
  postMessage = jest.fn((message: any): void => {
    this.onMessage.callListeners(message, this);
  });
  disconnect = jest.fn((): void => {
    this.onDisconnect.callListeners(this);
  });
}

export function mockChrome(): chrome {
  const storage: Partial<typeof chrome.storage> = {
    local: new MockLocalStorageArea(),
    sync: new MockSyncStorageArea(),
  };
  const onConnect = new MockEvent<(port: chrome.runtime.Port) => void>();
  const onMessage = new MockExtensionMessageEvent();
  const connect: typeof chrome.runtime.connect = jest.fn<
    chrome.runtime.Port,
    any
  >((connectInfo?: chrome.runtime.ConnectInfo): chrome.runtime.Port => {
    const name = connectInfo?.name;
    // Not sure what the default is — the types require a string for
    // Port.name but it's optional for connect(). We always provide one
    // though.
    assert(
      typeof name === "string",
      "mock chrome.runtime.connect() requires a name"
    );
    const port = new MockPort(name);
    onConnect.callListeners(port);
    return port;
  });

  const tabs: Partial<typeof chrome.tabs> = {
    query: jest.fn<any, any>().mockResolvedValue([]),
    sendMessage: jest
      .fn<any, any>()
      .mockRejectedValue(new Error("Not implemented")),
  };

  const scripting: Partial<typeof _chrome.scripting> = {
    executeScript: jest.fn<any, any>(),
  };

  const _chrome: Partial<chrome> = {
    storage: storage as typeof chrome.storage,
    runtime: {
      connect,
      onConnect: onConnect as chrome.runtime.ExtensionConnectEvent,
      onMessage: onMessage as chrome.runtime.ExtensionMessageEvent,
      sendMessage: jest
        .fn()
        .mockImplementation(
          onMessage.sendMessage
        ) as typeof chrome.runtime.sendMessage,
    } as typeof chrome.runtime,
    tabs: tabs as typeof chrome.tabs,
    scripting: scripting as typeof chrome.scripting,
  };
  return _chrome as chrome;
}
