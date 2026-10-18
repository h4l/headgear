const JSDOMEnvironment = require("jest-environment-jsdom").default;

/**
 * A Jest jsdom environment that exposes Node's fetch API.
 *
 * jsdom doesn't implement fetch, and Jest's jsdom environment hides Node's
 * implementation. fetch-mock uses the global fetch, Request, Response,
 * Headers and ReadableStream, so we copy just these from Node. (Not Blob etc,
 * as jsdom's own implementations need their own Blob.)
 */
class JSDOMEnvironmentWithFetch extends JSDOMEnvironment {
  constructor(...args) {
    super(...args);
    this.global.fetch = fetch;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.Headers = Headers;
    this.global.ReadableStream = ReadableStream;
  }
}

module.exports = JSDOMEnvironmentWithFetch;
