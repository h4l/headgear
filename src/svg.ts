import * as css from "css";
import {
  CssSelectorParser,
  Rule,
  RuleSet,
  Selectors,
} from "css-selector-parser";

import { assert, assertNever } from "./assert";

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

export interface PrefixedSVG {
  svg: SVGElement;
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

function _isStylesheet(node: css.Node): node is css.Stylesheet {
  return node.type === "stylesheet";
}
function _isRule(node: css.Node): node is css.Rule {
  return node.type === "rule";
}

interface ParentNode extends css.Node {
  rules?: Array<css.Node> | undefined;
}

function _isParentNode(node: css.Node): node is ParentNode {
  return "rules" in node;
}

/**
 * Rewrite any `.class` selector rules in a CSS stylesheet by adding a prefix to
 * them.
 *
 * The returned object contains the rewritten stylesheet and the Set of class
 * names found in the stylesheet's selectors (prior to prefixing and without the
 * leading `.`). i.e. the returned cssStylesheet has prefixes added, the
 * returned Set does not have prefixes added.
 */
export function addPrefixesToCSSStylesheetSelectorClasses({
  cssStylesheet,
  prefix,
}: {
  cssStylesheet: string;
  prefix: string;
}): PrefixedCSSStylesheet {
  const ast = css.parse(cssStylesheet);

  const classes = new Set<string>();
  const visitNode = (node: css.Node): void => {
    if (_isStylesheet(node)) {
      node.stylesheet && node.stylesheet.rules.forEach(visitNode);
    } else {
      // Only process rules which have declarations, as css.stringify() strips
      // out rules without declarations.
      if (_isRule(node) && node.selectors && node.declarations?.length) {
        node.selectors = node.selectors.map((selector) => {
          const { cssSelector, classes: selectorClasses } =
            addPrefixesToCSSSelectorClasses({
              cssSelector: selector,
              prefix,
            });
          for (const cls of selectorClasses) classes.add(cls);
          return cssSelector;
        });
      }
      if (_isParentNode(node) && node.rules) {
        node.rules.forEach(visitNode);
      }
    }
  };
  visitNode(ast);
  return {
    cssStylesheet: css.stringify(ast, {
      // stringify() pretty prints the output if compress is not enabled.
      compress: true,
      inputSourcemaps: false,
    }),
    classes,
  };
}

export function addPrefixesToElementClassAttribute({
  classAttribute,
  classes,
  prefix,
}: {
  classAttribute: string;
  classes: Set<string>;
  prefix: string;
}): string {
  return classAttribute
    .trim()
    .split(/\s+/)
    .map((cls) => (classes.has(cls) ? `${prefix}${cls}` : cls))
    .join(" ");
}

export function addPrefixesToSVGClassAttributes({
  svg,
  prefix,
  classes,
}: {
  svg: SVGElement;
  prefix: string;
  classes: Set<string>;
}): void {
  svg.querySelectorAll("[class]").forEach((el) => {
    const classAttribute = el.getAttribute("class");
    classAttribute &&
      el.setAttribute(
        "class",
        addPrefixesToElementClassAttribute({ classAttribute, classes, prefix })
      );
  });
}
