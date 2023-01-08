import { RenderOptions } from "opentype.js";

export const MESSAGE_TEXT_TO_PATH = "text-to-path";

export type TextAnchor = "start" | "middle" | "end";
export function isTextAnchor(value: unknown): value is TextAnchor {
  return typeof value === "string" && /^(?:start|middle|end)$/.test(value);
}
export interface TextToPathOptions {
  fontUrl: string;
  text: string;
  x?: number;
  y?: number;
  fontSize?: number;
  options?: RenderOptions;
  decimalPlaces?: number;
  textAnchor?: TextAnchor;
}

export interface TextToPathMessage extends TextToPathOptions {
  type: typeof MESSAGE_TEXT_TO_PATH;
}

export function isTextToPathMessage(
  value: unknown
): value is TextToPathMessage {
  return (
    typeof value === "object" &&
    (value as Partial<TextToPathMessage>).type === MESSAGE_TEXT_TO_PATH
  );
}

export function isValidResponse(
  value: unknown
): value is PromiseSettledResult<string> {
  if (typeof value === "object" && value !== null) {
    const result = value as Partial<PromiseSettledResult<unknown>>;
    return (
      (result.status === "rejected" && result.reason) ||
      (result.status === "fulfilled" && typeof result.value === "string")
    );
  }
  return false;
}
