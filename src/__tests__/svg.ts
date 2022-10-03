import { assert } from "../assert";
import {
  PrefixedCSSSelector,
  PrefixedCSSStylesheet,
  addPrefixesToCSSSelectorClasses,
  addPrefixesToCSSStylesheetSelectorClasses,
  addPrefixesToElementClassAttribute,
  addPrefixesToSVGClassAttributes,
} from "../svg";

test.each([
  [
    { cssSelector: ".foo", prefix: "ns-" },
    { cssSelector: ".ns-foo", classes: new Set(["foo"]) },
  ],
  [
    { cssSelector: "g#abc.foo, .baz.boz, g .foo .bar", prefix: "ns-" },
    {
      cssSelector: "g#abc.ns-foo, .ns-baz.ns-boz, g .ns-foo .ns-bar",
      classes: new Set(["foo", "bar", "baz", "boz"]),
    },
  ],
  // We totally don't need this but it's easy to do with the selector parser 🤷🙃
  [
    { cssSelector: 'a[class~="foo"]', prefix: "ns-" },
    { cssSelector: 'a[class~="ns-foo"]', classes: new Set(["foo"]) },
  ],
])(
  "addPrefixesToCSSSelectorClasses()",
  (
    options: { cssSelector: string; prefix: string },
    result: PrefixedCSSSelector
  ) => {
    expect(addPrefixesToCSSSelectorClasses(options)).toEqual(result);
  }
);

test.each([
  [
    { cssStylesheet: ".foo {fill:#000;}", prefix: "ns-" },
    { cssStylesheet: ".ns-foo{fill:#000;}", classes: new Set(["foo"]) },
  ],
  [
    {
      cssStylesheet: `\
g#abc.foo, .baz.boz, g .foo .bar {
 fill: #000;
}
/* rules without declarations get removed by css.stringify() */
.removed {}
.xxx.yyy {
  fill: #fff;
}
`,
      prefix: "ns-",
    },
    {
      cssStylesheet:
        "g#abc.ns-foo,.ns-baz.ns-boz,g .ns-foo .ns-bar{fill:#000;}.ns-xxx.ns-yyy{fill:#fff;}",
      classes: new Set(["foo", "bar", "baz", "boz", "xxx", "yyy"]),
    },
  ],
])(
  "addPrefixesToCSSStylesheetSelectorClasses()",
  (
    options: { cssStylesheet: string; prefix: string },
    result: PrefixedCSSStylesheet
  ) => {
    expect(addPrefixesToCSSStylesheetSelectorClasses(options)).toEqual(result);
  }
);

test.each([
  [{ classAttribute: "", classes: new Set(["foo", "bar"]), prefix: "ns-" }, ""],
  [
    {
      classAttribute: "foo bar baz",
      classes: new Set(["foo", "bar"]),
      prefix: "ns-",
    },
    "ns-foo ns-bar baz",
  ],
  [
    {
      classAttribute: " foo   bar\tbaz ",
      classes: new Set(["foo", "bar"]),
      prefix: "ns-",
    },
    "ns-foo ns-bar baz",
  ],
])("addPrefixesToElementClassAttribute()", (options, expected) => {
  expect(addPrefixesToElementClassAttribute(options)).toBe(expected);
});

test("addPrefixesToSVGClassAttributes()", () => {
  const svgDoc = `\
<svg xmlns="http://www.w3.org/2000/svg">
  <g class="foo">
    <rect width="5" height="6" class="foo bar baz boz" />
    <defs>
      <circle class="" cx="0" cy="0" r="2"/>
      <circle class="boz" cx="5" cy="6" r="1"/>
      <circle class="foo" cx="2" cy="3" r="4"/>
    </defs>
  </g>
</svg>
`;
  const svg = new DOMParser().parseFromString(
    svgDoc,
    "image/svg+xml"
  ).firstElementChild;
  assert(svg instanceof SVGElement);
  addPrefixesToSVGClassAttributes({
    svg,
    prefix: "ns-",
    classes: new Set(["foo", "bar", "baz"]),
  });
  expect(new XMLSerializer().serializeToString(svg)).toMatchInlineSnapshot(`
    "<svg xmlns="http://www.w3.org/2000/svg">
      <g class="ns-foo">
        <rect width="5" height="6" class="ns-foo ns-bar ns-baz boz"/>
        <defs>
          <circle class="" cx="0" cy="0" r="2"/>
          <circle class="boz" cx="5" cy="6" r="1"/>
          <circle class="ns-foo" cx="2" cy="3" r="4"/>
        </defs>
      </g>
    </svg>"
  `);
});
