import {
  CssSelectorParser,
  Rule,
  RuleSet,
  Selectors,
} from "css-selector-parser";

import { assertNever } from "./assert";

const cssSelectors = new CssSelectorParser();
cssSelectors.registerAttrEqualityMods("~");

export interface PrefixedCSSSelector {
  cssSelector: string;
  classes: Set<string>;
}

export interface PrefixedCSSStylesheet {
  cssStylesheet: string;
  classes: Set<string>;
}

/**
 * Rewrite any `.class` rules in a CSS selector by adding a prefix to them.
 *
 * The returned object contains the rewritten selector and the Set of class
 * names found in the selector (prior to prefixing and without the leading `.`).
 * i.e. the returned cssSelector has prefixes added, the returned Set does not
 * have prefixes added.
 */
export function addPrefixesToCSSSelectorClasses({
  cssSelector,
  prefix,
}: {
  cssSelector: string;
  prefix: string;
}): PrefixedCSSSelector {
  const ast = cssSelectors.parse(cssSelector);

  const classes = new Set<string>();
  const visitNode = (node: Selectors | RuleSet | Rule): void => {
    if (node.type === "ruleSet") {
      visitNode(node.rule);
    } else if (node.type === "selectors") {
      node.selectors.forEach(visitNode);
    } else if (node.type === "rule") {
      if (node.classNames !== undefined) {
        node.classNames.forEach((cls) => {
          classes.add(cls);
        });
        node.classNames = node.classNames.map((cls) => `${prefix}${cls}`);
      }
      (node.attrs || []).forEach((attr) => {
        if (
          attr.name === "class" &&
          "operator" in attr &&
          attr.operator === "~=" &&
          attr.valueType === "string"
        ) {
          classes.add(attr.value);
          attr.value = `${prefix}${attr.value}`;
        }
      });
      if (node.rule) visitNode(node.rule);
    } else {
      assertNever(node);
    }
  };
  visitNode(ast);
  return {
    cssSelector: cssSelectors.render(ast),
    classes,
  };
}
