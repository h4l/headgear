import { CallExpression, NewExpression, Options, Program, parse } from "acorn";
import * as walk from "acorn-walk";
import MagicString from "magic-string";
import {
  RawSourceMap,
  SourceMapConsumer,
  SourceMapGenerator,
} from "source-map-js";
import type { LoaderContext } from "webpack";

type SourceMap = Parameters<LoaderContext<unknown>["callback"]>[2];

/**
 * A webpack loader that replaces `Function("return this")()` calls.
 *
 * The lodash library (and probably other things) use the Function constructor
 * in this way to get a reference to `globalThis` in a way that supports
 * runtimes without `globalThis`. This is problematic because Chrome Web Store
 * and Firefox Add-ons have policies that disallow use of `eval()` and the
 * function constructor.
 *
 * This loader replaces `Function("return this")` occurrences with
 * `(() => globalThis)`.
 *
 * Ported from Vaultonomy's rollup-plugin-function-constructor-return-this.ts.
 */
export default function functionConstructorReturnThisLoader(
  this: LoaderContext<unknown>,
  code: string,
  inputSourceMap?: SourceMap
): void {
  // Bail out early if there are definitely no Function constructors
  if (code.search(/\bFunction\s*\(/) === -1) {
    this.callback(null, code, inputSourceMap);
    return;
  }

  let ast: Program;
  try {
    ast = parseModuleOrScript(code);
  } catch (err) {
    this.emitWarning(
      new Error(
        `functionConstructorReturnThisLoader: failed to parse ${this.resourcePath}: ${err}. Exclude this file from the loader's rule to ignore it.`
      )
    );
    this.callback(null, code, inputSourceMap);
    return;
  }

  const magicString = new MagicString(code);
  let replacementMade = false;

  const visit = (node: CallExpression | NewExpression) => {
    if (isFunctionConstructorReturnThis(node)) {
      replacementMade = true;
      magicString.update(node.start, node.end, "(() => globalThis)");
    }
  };
  walk.simple(ast, { CallExpression: visit, NewExpression: visit });

  if (!replacementMade) {
    this.callback(null, code, inputSourceMap);
    return;
  }

  if (!this.sourceMap) {
    this.callback(null, magicString.toString());
    return;
  }

  const editMap = magicString.generateMap({
    hires: true,
    source: this.resourcePath,
    includeContent: true,
  });
  // Trace our edits back through the map from previous loaders (if any), so
  // the result maps to the original source.
  let sourceMap: SourceMap = editMap;
  if (inputSourceMap) {
    const generator = SourceMapGenerator.fromSourceMap(
      new SourceMapConsumer(asRawSourceMap(editMap))
    );
    generator.applySourceMap(
      new SourceMapConsumer(asRawSourceMap(inputSourceMap)),
      this.resourcePath
    );
    sourceMap = generator.toString();
  }
  this.callback(null, magicString.toString(), sourceMap);
}

/**
 * source-map-js types a source map's version as a string, whereas webpack and
 * magic-string use a number (which is correct). source-map-js accepts either at
 * runtime.
 */
function asRawSourceMap(map: string | object): RawSourceMap {
  return (typeof map === "string" ? JSON.parse(map) : map) as RawSourceMap;
}

function parseModuleOrScript(code: string): Program {
  const options: Options = {
    ecmaVersion: "latest",
    allowHashBang: true,
    allowReturnOutsideFunction: true,
  };
  try {
    return parse(code, { ...options, sourceType: "module" });
  } catch {
    // Not all CommonJS code is valid in strict mode
    return parse(code, { ...options, sourceType: "script" });
  }
}

/**
 * Check if the node is a call to the Function constructor like:
 *
 * `Function("return this")`  or `new Function("return this")`
 */
function isFunctionConstructorReturnThis(
  node: CallExpression | NewExpression
): boolean {
  const [arg] = node.arguments;
  return (
    node.callee.type === "Identifier" &&
    node.callee.name === "Function" &&
    node.arguments.length === 1 &&
    arg.type === "Literal" &&
    typeof arg.value === "string" &&
    isUnevaluatedReturnThis(arg.value)
  );
}

/** @returns true if code is a code snippet like "return this" (ignoring whitespace). */
function isUnevaluatedReturnThis(code: string): boolean {
  // Could actually parse the code, but this is probably fine...
  return /^\s*return[ \t]+this[ \t]*(?:[\r\n;]|$)/.test(code);
}
