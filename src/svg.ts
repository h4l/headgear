import * as css from "css";
import {
  CssSelectorParser,
  Rule,
  RuleSet,
  Selectors,
} from "css-selector-parser";

import { assert, assertNever } from "./assert";
import { NFTInfo, ResolvedAccessory, ResolvedAvatar } from "./avatars";
import { default as headshotCircleTemplateSrc } from "./img/avatar-svg/headshot-circle-template.svg";
import { default as headshotCommentsTemplateSrc } from "./img/avatar-svg/headshot-comments-template.svg";
import { default as nftCardTemplateSrc } from "./img/avatar-svg/nft-card-template.svg";
import { default as nftIconSrc } from "./img/avatar-svg/nft-icon.svg";
import { default as nftNameWithCountSrc } from "./img/avatar-svg/nft-name-with-count.svg";
import { default as nftNameSrc } from "./img/avatar-svg/nft-name.svg";
import { default as redditLogoLightSrc } from "./img/avatar-svg/reddit-logo-light.svg";
import {
  FONT_REDDIT_SANS_BOLD,
  FONT_REDDIT_SANS_EXTRABOLD,
  textToPath,
} from "./text-to-path";
import { isTextAnchor } from "./text-to-path/interface";

export const SVGNS = "http://www.w3.org/2000/svg";
const XLINKNS = "http://www.w3.org/1999/xlink";
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

/**
 * Fail if an avatar's customisation style objects have any unexpected
 * properties.
 *
 * If new accessories are released that customise something other than fill
 * color then this should fail, preventing us from rendering the avatar
 * incorrectly, and alerting us of the need to support the new property.
 */
function _validateAvatarStyleValues(avatar: ResolvedAvatar): void {
  avatar.styles.forEach((style) => {
    const props = Object.getOwnPropertyNames(style);
    if (!(props.length === 2 && "className" in style && "fill" in style)) {
      throw new Error(
        `Customisation style object contains unsupported properties: ${JSON.stringify(
          style
        )}`
      );
    }
  });
}

export function createAccessoryCustomisationCSSRules(
  avatar: ResolvedAvatar
): string {
  _validateAvatarStyleValues(avatar);

  // The fill value is applied to a "color-$NAME" class, not the literal
  // className as specified.
  return avatar.styles
    .map((style) => `.color-${style.className}{fill:${style?.fill}}`)
    .join("");
}

export class SVGParseError extends Error {
  constructor({
    message,
    parseError,
  }: {
    message: string;
    parseError: string;
  }) {
    super(SVGParseError._formatMessage(message, parseError));
  }

  static _formatMessage(
    message: string,
    parseError: string | undefined
  ): string {
    return parseError ? `${message}: ${parseError}` : message;
  }
}

export function parseSVG({
  svgSource,
  parseErrorMessage,
  rootElement: _rootElement,
}: {
  svgSource: string;
  parseErrorMessage?: string;
  rootElement?: string;
}): SVGElement {
  const rootElement = _rootElement ?? "svg";
  const svgDoc = new DOMParser().parseFromString(svgSource, "image/svg+xml");
  const errorMessage = parseErrorMessage || "Failed to parse SVG XML.";
  const error = svgDoc.querySelector("parsererror");
  if (error)
    throw new SVGParseError({
      message: errorMessage,
      parseError: error.textContent || "",
    });
  const svg = svgDoc.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new SVGParseError({
      message: errorMessage,
      parseError: `Parsed document root element is not an SVGElement (does the parsed source contain an SVG xmlns attribute?)`,
    });
  }
  if (svg?.nodeName !== rootElement) {
    throw new SVGParseError({
      message: errorMessage,
      parseError: `Expected root element to be ${rootElement} but was ${svg?.nodeName}`,
    });
  }
  stripWhitespaceAndComments(svg);
  return svg;
}

function _parseAccessorySVG(accessory: ResolvedAccessory): SVGElement {
  return parseSVG({
    svgSource: accessory.svgData,
    parseErrorMessage: `Accessory ${JSON.stringify(
      accessory.id
    )}'s SVG failed to parse`,
  });
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
  index,
}: {
  accessory: ResolvedAccessory;
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

const ACC_W = 380;
const ACC_H = 600;

export function composeAvatarSVG({
  avatar,
}: {
  avatar: ResolvedAvatar;
}): SVGElement {
  const accessories = [...avatar.accessories];
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
    prepareAccessorySVG({ accessory, index })
  );
  const customisationStyles = createAccessoryCustomisationCSSRules(avatar);

  const doc = new DOMParser().parseFromString(
    // All the accessories use the viewBox 0 0 380 600
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ACC_W} ${ACC_H}"><style></style><g id="avatar"></g></svg>`,
    "image/svg+xml"
  );
  const rootSvg = doc.firstElementChild;
  const style = rootSvg?.querySelector("style");
  const avatarGroup = rootSvg?.querySelector("#avatar");
  assert(
    rootSvg instanceof SVGElement && style && avatarGroup instanceof SVGElement
  );

  const accessoryStyles = preparedAccessories
    .map(({ stylesheet }, i) => `/* ${accessories[i].id} */\n${stylesheet}`)
    .join("\n");
  style.textContent = `${accessoryStyles}\n/* customisation styles */\n${customisationStyles}`;

  preparedAccessories.forEach(({ svg }) => {
    avatarGroup.appendChild(doc.importNode(svg, true));
  });
  if (accessories.some((acc) => acc.id === "dubbl3bee_body_001")) {
    applyDubbl3beeRecursion(avatarGroup);
  }

  return rootSvg;
}

/**
 * https://www.reddit.com/r/avatartrading/comments/y3pyiz/
 */
function applyDubbl3beeRecursion(avatarGroup: SVGElement): void {
  const avatarElements = Array.from(avatarGroup.children);
  const bodyPos = avatarElements.findIndex(
    (el) => el.getAttribute("id") === "dubbl3bee_body_001"
  );
  if (bodyPos < 0) return;
  avatarElements.forEach((el) => el.remove());
  const lower = avatarGroup.ownerDocument.createElementNS(SVGNS, "g");
  const upper = avatarGroup.ownerDocument.createElementNS(SVGNS, "g");
  lower.setAttribute("id", "avatar-lower");
  upper.setAttribute("id", "avatar-upper");
  avatarElements.forEach((el, i) => {
    (i <= bodyPos ? lower : upper).appendChild(el);
  });
  const ref = (name: "lower" | "upper", depth: 1 | 2): SVGElement => {
    const use = avatarGroup.ownerDocument.createElementNS(SVGNS, "use");
    use.setAttributeNS(XLINKNS, "href", `#avatar-${name}`);
    use.setAttribute(
      "transform",
      new Array(depth).fill("translate(140 426.3) scale(0.0055)").join(" ")
    );
    return use;
  };
  avatarGroup.appendChild(lower);
  avatarGroup.appendChild(ref("lower", 1));
  avatarGroup.appendChild(ref("lower", 2));
  avatarGroup.appendChild(ref("upper", 1));
  avatarGroup.appendChild(ref("upper", 2));
  avatarGroup.appendChild(upper);
}

function redditLogoSVG(): SVGElement {
  const redditLogo = parseSVG({ svgSource: redditLogoLightSrc });
  redditLogo.id = "reddit-logo";
  return redditLogo;
}

const STD_W = 587;
const STD_H = 718;

export function createStandardAvatarSVG({
  composedAvatar,
}: {
  composedAvatar: SVGElement;
}): SVGElement {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STD_W} ${STD_H}"></svg>`,
    "image/svg+xml"
  );
  let redditLogo = redditLogoSVG();

  const svg = doc.firstElementChild;
  assert(svg && svg instanceof SVGElement);
  composedAvatar = doc.importNode(composedAvatar, true);
  redditLogo = doc.importNode(redditLogo, true);

  const bg = svg.appendChild(doc.createElementNS(SVGNS, "rect"));
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "white");

  svg.appendChild(composedAvatar);
  svg.appendChild(redditLogo);

  composedAvatar.setAttribute("y", "35");
  composedAvatar.setAttribute("height", `${ACC_H}`);
  redditLogo.setAttribute("width", "94.5");
  redditLogo.setAttribute("preserveAspectRatio", "xMinYMax");
  redditLogo.setAttribute("x", "11.5");
  redditLogo.setAttribute("y", "-11.5");

  return svg;
}

export function parseViewBox(el: Element): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const viewBoxStr = el.getAttribute("viewBox");
  if (viewBoxStr === null) throw new Error("el has no viewBox attribute");
  const viewBoxPieces = viewBoxStr.split(" ").map(parseFloat);
  if (
    viewBoxPieces.length !== 4 ||
    viewBoxPieces.filter(Number.isNaN).length !== 0
  ) {
    throw new Error(`invalid viewBox: ${viewBoxStr}`);
  }
  const [x, y, w, h] = viewBoxPieces;
  return { x, y, w, h };
}

function getAbsolutePosition(el: Element, axis: "x" | "y"): number {
  const valueStr = el.getAttribute(axis);
  if (valueStr === null) throw new Error(`el has no ${axis} attribute`);
  if (!valueStr.endsWith("%")) {
    const value = parseFloat(valueStr);
    assert(!Number.isNaN(value));
    return value;
  }
  // % values are resolved to absolute values by resolving the % value against
  // the viewBox they're nested under.
  // In our use cases the parent element is always an svg el with a viewBox
  assert(el.parentElement && el.parentElement.hasAttribute("viewBox"));
  const { x, y, w, h } = parseViewBox(el.parentElement);
  const [base, size] = axis === "x" ? [x, w] : [y, h];
  const fraction = parseFloat(valueStr.replace("%", "")) / 100;
  return base + size * fraction;
}

export async function _nftNameSVG(options: {
  nftInfo: NFTInfo;
  variant: NFTCardVariant;
}): Promise<SVGElement> {
  const { nftInfo, variant } = options;
  const invisibleTextStyle =
    "fill-opacity:0;stroke-opacity:0;font-family:Arial";
  let svg;
  let seriesSizeNumerator: Element | null | undefined;
  let seriesSize: Element | null | undefined;
  if (nftInfo.seriesSize === null) {
    svg = parseSVG({ svgSource: nftNameSrc });
  } else {
    svg = parseSVG({ svgSource: nftNameWithCountSrc });
    seriesSizeNumerator = svg.querySelector("#series-size-numerator");
    seriesSize = svg.querySelector("#series-size");
    assert(seriesSize);
    seriesSize.textContent =
      nftInfo.seriesSize < 1000
        ? nftInfo.seriesSize.toFixed(0)
        : `${(nftInfo.seriesSize / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  const name = svg.querySelector("#nft-name");
  assert(name);
  name.textContent = nftInfo.name;

  // The series size badge and name text are smaller in SHOP_INVENTORY.
  if (variant === NFTCardVariant.SHOP_INVENTORY) {
    assert(svg.getAttribute("viewBox") === "0 0 552 94");
    svg.setAttribute("viewBox", "0 0 552 58");
    name.setAttribute("x", nftInfo.seriesSize === null ? "32.5" : "87");
    name.setAttribute("y", "68%");
    name.setAttribute("font-size", "29.1");
  }

  // Generate concrete SVG <path> elements for all the <text>, so that we don't
  // need to embed or reference the web fonts.
  const textEls = [name, seriesSize, seriesSizeNumerator].filter(
    (x): x is Element => !!x
  );
  await Promise.all(
    textEls.map((textEl) =>
      (async () => {
        const text = textEl.textContent;
        assert(text !== null);
        const textAnchor = textEl.getAttribute("text-anchor") ?? undefined;
        assert(
          isTextAnchor(textAnchor) || textAnchor === undefined,
          `invalid textAnchor: ${textAnchor}`
        );
        const fontSize = parseFloat(textEl.getAttribute("font-size") ?? "");
        assert(!Number.isNaN(fontSize));
        const fontWeight = textEl.getAttribute("font-weight");
        assert(fontWeight === "800" || fontWeight === "bold");
        const x = getAbsolutePosition(textEl, "x");
        const y = getAbsolutePosition(textEl, "y");
        const fontUrl =
          fontWeight === "bold"
            ? FONT_REDDIT_SANS_BOLD
            : FONT_REDDIT_SANS_EXTRABOLD;

        const textPath = await textToPath({
          fontUrl,
          fontSize,
          x,
          y,
          text,
          textAnchor,
        });
        textEl.insertAdjacentElement("beforebegin", textPath);

        const textStyle = textEl.getAttribute("style");
        assert(textStyle !== null);
        const textFilter = textEl.getAttribute("filter");
        const textMask = textEl.getAttribute("mask");

        textPath.setAttribute("style", _removeFontStyles(textStyle));
        textFilter && textPath.setAttribute("filter", textFilter);
        textMask && textPath.setAttribute("mask", textMask);

        // Retain the real <text> el for metadata and to allow the text to be
        // copied.
        textEl.setAttribute("style", invisibleTextStyle);
        textEl.removeAttribute("filter");
        textEl.removeAttribute("mask");
      })()
    )
  );

  // The style just contains web font references which aren't needed.
  svg.querySelector("style")?.remove();
  return svg;
}

function _removeFontStyles(cssStyle: string): string {
  return cssStyle.replace(/(?<=(^|;))font-[^;]+(;|$)/g, "");
}

export enum NFTCardVariant {
  PROFILE_PAGE,
  SHOP_INVENTORY,
}

export async function createNFTCardAvatarSVG({
  composedAvatar,
  nftInfo,
  variant,
}: {
  composedAvatar: SVGElement;
  nftInfo: NFTInfo;
  variant: NFTCardVariant;
}): Promise<SVGElement> {
  const svg = parseSVG({ svgSource: nftCardTemplateSrc });
  const doc = svg.ownerDocument;

  composedAvatar = svg.appendChild(doc.importNode(composedAvatar, true));
  const nftName = svg.appendChild(
    doc.importNode(await _nftNameSVG({ nftInfo, variant }), true)
  );
  const nftIcon = svg.appendChild(
    doc.importNode(parseSVG({ svgSource: nftIconSrc }), true)
  );

  composedAvatar.setAttribute("y", "63");
  composedAvatar.setAttribute("height", `${ACC_H}`);

  nftIcon.setAttribute("preserveAspectRatio", "xMaxYMin");
  nftIcon.removeAttribute("width");
  nftIcon.setAttribute("height", "52");
  if (variant === NFTCardVariant.PROFILE_PAGE) {
    nftIcon.setAttribute("x", "-31");
    nftIcon.setAttribute("y", "32");
  } else {
    assert(variant === NFTCardVariant.SHOP_INVENTORY);
    nftIcon.setAttribute("x", "-25.5");
    nftIcon.setAttribute("y", "26");
  }

  nftName.setAttribute("preserveAspectRatio", "xMinYMax");
  nftName.setAttribute("y", "-32.5");

  const cardBgImg = svg.querySelector("#nft-card-bg") as SVGImageElement;
  assert(cardBgImg);
  cardBgImg.setAttributeNS(XLINKNS, "href", nftInfo.backgroundImage.dataUrl);

  return svg;
}

const HEADSHOT_CIRCLE_RADIUS = 153.5;
const HEADSHOT_CIRCLE_BASE_HEIGHT = 544;

export function createHeadshotCircleAvatarSVG({
  composedAvatar,
}: {
  composedAvatar: SVGElement;
}): SVGElement {
  const svg = parseSVG({ svgSource: headshotCircleTemplateSrc });
  const doc = svg.ownerDocument;

  const viewBox = svg.getAttribute("viewBox")?.split(" ");
  assert(viewBox?.length === 4);

  const avatar: SVGElement = svg.appendChild(
    doc.importNode(composedAvatar, true)
  );
  assert(avatar instanceof SVGGraphicsElement);
  avatar.setAttribute("width", `${ACC_W}`);
  avatar.setAttribute("height", `${ACC_H}`);
  avatar.setAttribute("clip-path", "url(#avatar-upper)");

  // The heights of avatars vary according to their headgear (erm, as in actual
  // headgear, not this program). Unless we resize the SVG to fit the avatar,
  // we'll have quite a bit of empty space above many avatars. So we'll measure
  // the rendered avatar and adjust the size of the generated SVG. To measure it
  // we need to temporarily insert it into the page DOM, otherwise the reported
  // sizes are 0.
  svg.setAttribute("style", "position: absolute; visibility: hidden");
  window.document.body.append(svg);
  const avatarArea = avatar.getBBox();
  const padding = ACC_W / 2 - HEADSHOT_CIRCLE_RADIUS;
  const top = Math.max(0, avatarArea.y - padding);
  const height = HEADSHOT_CIRCLE_BASE_HEIGHT - top;
  viewBox[1] = `${top}`;
  viewBox[3] = `${height}`;
  svg.setAttribute("viewBox", viewBox.join(" "));
  svg.remove();
  svg.removeAttribute("style");

  return svg;
}

// The distance from the image edge to the edge of the hex background's stroke
const HEADSHOT_COMMENTS_PADDING = 39;
const HEADSHOT_COMMENTS_BASE_HEIGHT = 540;

export function createHeadshotCommentsAvatarSVG({
  composedAvatar,
}: {
  composedAvatar: SVGElement;
}): SVGElement {
  const svg = parseSVG({ svgSource: headshotCommentsTemplateSrc });
  const doc = svg.ownerDocument;

  const viewBox = svg.getAttribute("viewBox")?.split(" ");
  assert(viewBox?.length === 4);

  const avatar: SVGElement = doc.importNode(composedAvatar, true);
  svg
    .querySelector("#hex-frame-background")
    ?.insertAdjacentElement("afterend", avatar);
  assert(avatar.parentElement);

  assert(avatar instanceof SVGGraphicsElement);
  avatar.setAttribute("width", `${ACC_W}`);
  avatar.setAttribute("height", `${ACC_H}`);
  avatar.setAttribute("clip-path", "url(#avatar-upper)");

  // As with createHeadshotCircleAvatarSVG() we need to adjust the size of the
  // image according to the Avatar, so we need to insert the SVG into the page
  // DOM.
  svg.setAttribute("style", "position: absolute; visibility: hidden");
  window.document.body.append(svg);
  const avatarArea = avatar.getBBox();
  const top = Math.max(0, avatarArea.y - HEADSHOT_COMMENTS_PADDING);
  const height = HEADSHOT_COMMENTS_BASE_HEIGHT - top;
  viewBox[1] = `${top}`;
  viewBox[3] = `${height}`;
  svg.setAttribute("viewBox", viewBox.join(" "));
  svg.remove();
  svg.removeAttribute("style");

  return svg;
}

export const _internals = {
  parseViewBox,
  getAbsolutePosition,
};
