import * as css from "css";
import {
  CssSelectorParser,
  Rule,
  RuleSet,
  Selectors,
} from "css-selector-parser";

import { assert, assertNever } from "./assert";
import { ResolvedAccessory, ResolvedAvatar, SVGStyle } from "./avatars";

const SVGNS = "http://www.w3.org/2000/svg";
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

export function createAccessoryCustomisedCSSRules({
  accessory,
  styles,
}: {
  accessory: ResolvedAccessory;
  styles: SVGStyle[];
}): string {
  return accessory.customizableClasses
    .map((cls) => {
      const style = styles.find((s) => s.className === cls);
      if (!style)
        throw new Error(
          `Accessory ${JSON.stringify(
            accessory.id
          )} has a customisable class ${JSON.stringify(
            cls
          )} but no style value exists for it.`
        );
      return `.${cls}{fill:${style?.fill}}`;
    })
    .join("");
}

export class SVGParseError extends Error {
  readonly parseError: string;
  constructor({
    message,
    parseError,
  }: {
    message: string;
    parseError: string;
  }) {
    super(message);
    this.parseError = parseError;
  }
}

function _parseAccessorySVG(accessory: ResolvedAccessory): SVGElement {
  const svgDoc = new DOMParser().parseFromString(
    accessory.svgData,
    "image/svg+xml"
  );
  const error = svgDoc.querySelector("parsererror");
  if (error)
    throw new SVGParseError({
      message: `Accessory ${JSON.stringify(
        accessory.id
      )}'s SVG failed to parse`,
      parseError: error.textContent || "",
    });
  const svg = svgDoc.firstElementChild;
  assert(svg instanceof SVGElement);
  stripWhitespaceAndComments(svg);
  return svg;
}

export function stripWhitespaceAndComments(node: Node): void {
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const child = node.childNodes[i];
    if (
      child.nodeType === Node.COMMENT_NODE ||
      (child.nodeType === Node.TEXT_NODE &&
        /^\s*$/.test(child.textContent || ""))
    ) {
      child.remove();
    } else if (child.hasChildNodes()) {
      stripWhitespaceAndComments(child);
    }
  }
}

export function safeId({ id, index }: { id: string; index: number }): string {
  return /^[\w-]+$/.test(id) ? id : `accessory${index}`;
}

/**
 * Transform an accessory's SVG for merging with other accessories.
 *
 * The SVG's <style> elements are removed, merged into one stylesheet and
 * classes used in rule selectors are given a unique prefix. Element class
 * attributes using these classes are also rewritten to use these prefixed
 * classes.
 */
export function prepareAccessorySVG({
  accessory,
  styles,
  index,
}: {
  accessory: ResolvedAccessory;
  styles: SVGStyle[];
  index: number;
}): { svg: SVGGElement; stylesheet: string } {
  const id = safeId({ id: accessory.id, index });
  const prefix = `${id}-`;
  const svg = _parseAccessorySVG(accessory);

  const stylesheets: string[] = [];
  svg.querySelectorAll("style").forEach((style) => {
    const stylesheet = style.textContent;
    style.remove();
    if (stylesheet?.trim()) stylesheets.push(stylesheet);
  });
  stylesheets.push(createAccessoryCustomisedCSSRules({ accessory, styles }));
  const { cssStylesheet, classes } = addPrefixesToCSSStylesheetSelectorClasses({
    cssStylesheet: stylesheets.join("\n"),
    prefix,
  });

  addPrefixesToSVGClassAttributes({ svg, classes, prefix });

  const accessoryGroup = svg.ownerDocument.createElementNS(
    SVGNS,
    "g"
  ) as SVGGElement;
  accessoryGroup.setAttribute("id", id);
  Array.from(svg.childNodes).forEach((node) => {
    node.remove();
    accessoryGroup.appendChild(node);
  });

  return { svg: accessoryGroup, stylesheet: cssStylesheet };
}

export function composeAvatarSVG({
  avatar,
}: {
  avatar: ResolvedAvatar;
}): SVGElement {
  const accessories = [...avatar.accessories];
  const styles = avatar.styles;
  // In the SVG, accessories are layered by slotNumber, lowest to highest
  accessories.sort((a, b) => a.slotNumber - b.slotNumber);
  // Each accessory has its own SVG doc, with its own CSS styles and class
  // names. We need to merge these into a single SVG doc, so we need to ensure
  // styles in one doc can't affect another. This could be done by scoping CSS
  // rules (#accessory-1 .some-class { ... }). While manually-creating merged
  // docs, I've found that Inkscape has rather primitive CSS support — it only
  // recognises the first style element in a doc, and it only supports matching
  // CSS rules using a single class, not scoped rules. Browsers are fine, but
  // it seems possible that other editors have poor support for CSS in SVG, and
  // I personally value having Inkscape support, so Inkscape is going to be the
  // "IE6" of this project.
  //
  // Long story short, we need a single style element, with rule selectors using
  // only one class. To do that we rewrite class names in each SVG document with
  // a unique prefix to guarantee uniqueness. Then we just merge the
  // stylesheets.

  const preparedAccessories = accessories.map((accessory, index) =>
    prepareAccessorySVG({ accessory, index, styles })
  );

  const doc = new DOMParser().parseFromString(
    // All the accessories use the viewBox 0 0 380 600
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 600"><style></style><g id="avatar"></g></svg>`,
    "image/svg+xml"
  );
  const rootSvg = doc.firstElementChild;
  const style = rootSvg?.querySelector("style");
  const avatarGroup = rootSvg?.querySelector("#avatar");
  assert(rootSvg instanceof SVGElement && style && avatarGroup);

  style.textContent = preparedAccessories
    .map(({ stylesheet }, i) => {
      return `\
/* ${accessories[i].id} */
${stylesheet}`;
    })
    .join("\n");
  preparedAccessories.forEach(({ svg }) => {
    avatarGroup.appendChild(doc.importNode(svg, true));
  });
  return rootSvg;
}
