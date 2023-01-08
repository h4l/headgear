import {
  TextToPathMessage,
  isTextToPathMessage,
  isValidResponse,
} from "../interface";

describe("isTextToPathMessage", () => {
  test("accepts valid message", () => {
    const message: TextToPathMessage = {
      type: "text-to-path",
      fontUrl: "/foo",
      text: "Hi",
    };
    expect(isTextToPathMessage(message)).toBeTruthy();
  });
  test("rejects invalid message", () => {
    expect(isTextToPathMessage(undefined)).toBeFalsy();
    expect(isTextToPathMessage({})).toBeFalsy();
    expect(isTextToPathMessage(42)).toBeFalsy();
  });
});

describe("isValidResponse", () => {
  test("accepts valid successful response", () => {
    const response: PromiseSettledResult<string> = {
      status: "fulfilled",
      value: '<path d=""/>',
    };
    expect(isValidResponse(response)).toBeTruthy();
  });
  test("accepts valid unsuccessful response", () => {
    const response: PromiseSettledResult<string> = {
      status: "rejected",
      reason: "Something's wrong",
    };
    expect(isValidResponse(response)).toBeTruthy();
  });
  test("rejects invalid response", () => {
    expect(isValidResponse(undefined)).toBeFalsy();
    expect(isValidResponse({})).toBeFalsy();
    expect(isValidResponse(42)).toBeFalsy();
  });
});
