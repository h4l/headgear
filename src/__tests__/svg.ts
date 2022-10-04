import { assert } from "../assert";
import { ResolvedAccessory, ResolvedAvatar, SVGStyle } from "../avatars";
import {
  PrefixedCSSSelector,
  PrefixedCSSStylesheet,
  SVGParseError,
  addPrefixesToCSSSelectorClasses,
  addPrefixesToCSSStylesheetSelectorClasses,
  addPrefixesToElementClassAttribute,
  addPrefixesToSVGClassAttributes,
  composeAvatarSVG,
  createAccessoryCustomisedCSSRules,
  prepareAccessorySVG,
  safeId,
  stripWhitespaceAndComments,
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
    { cssStylesheet: ".foo {fill:#000}", prefix: "ns-" },
    { cssStylesheet: ".ns-foo{fill:#000;}", classes: new Set(["foo"]) },
  ],
  [
    {
      cssStylesheet: `\
g#abc.foo, .baz.boz, g .foo .bar {
 fill: #000
}
/* rules without declarations get removed by css.stringify() */
.removed {}
.xxx.yyy {
  fill: #fff
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
  stripWhitespaceAndComments(svg);

  addPrefixesToSVGClassAttributes({
    svg,
    prefix: "ns-",
    classes: new Set(["foo", "bar", "baz"]),
  });
  expect(svg).toMatchInlineSnapshot(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        class="ns-foo"
      >
        <rect
          class="ns-foo ns-bar ns-baz boz"
          height="6"
          width="5"
        />
        <defs>
          <circle
            class=""
            cx="0"
            cy="0"
            r="2"
          />
          <circle
            class="boz"
            cx="5"
            cy="6"
            r="1"
          />
          <circle
            class="ns-foo"
            cx="2"
            cy="3"
            r="4"
          />
        </defs>
      </g>
    </svg>
  `);
});

const accessory: ResolvedAccessory = {
  id: "example",
  customizableClasses: ["foo", "bar"],
  slotNumber: 0,
  svgData: '<svg xmlns="http://www.w3.org/2000/svg"/>',
};
const styles: SVGStyle[] = [
  { className: "foo", fill: "red" },
  { className: "bar", fill: "#aabbcc" },
  { className: "other", fill: "#fff" },
];

test("createAccessoryCustomisedCSSRules()", () => {
  expect(createAccessoryCustomisedCSSRules({ accessory, styles })).toBe(
    `.foo{fill:red}.bar{fill:#aabbcc}`
  );
  expect(() =>
    createAccessoryCustomisedCSSRules({
      accessory: { ...accessory, customizableClasses: ["missing"] },
      styles,
    })
  ).toThrowError(
    `Accessory "example" has a customisable class "missing" but no style value exists for it.`
  );
});

test("safeId()", () => {
  expect(safeId({ id: "foo", index: 2 })).toBe("foo");
  expect(safeId({ id: "foo bar", index: 2 })).toBe("accessory2");
});

describe("prepareAccessorySVG()", () => {
  test("extracts and namespaces SVG elements and CSS", () => {
    const svgData = `\
<svg xmlns="http://www.w3.org/2000/svg">
  <style>.foo {stroke:#fff;}</style>
  <g class="foo">
    <style>.bar, .baz {stroke:#000;}</style>
    <rect width="5" height="6" class="foo bar baz boz" />
    <defs>
      <circle class="" cx="0" cy="0" r="2"/>
      <circle class="boz" cx="5" cy="6" r="1"/>
      <circle class="foo" cx="2" cy="3" r="4"/>
    </defs>
  </g>
</svg>`;
    const { svg, stylesheet } = prepareAccessorySVG({
      accessory: {
        ...accessory,
        svgData,
      },
      index: 0,
      styles,
    });
    expect(stylesheet).toMatchInlineSnapshot(
      `".example-foo{stroke:#fff;}.example-bar,.example-baz{stroke:#000;}.example-foo{fill:red;}.example-bar{fill:#aabbcc;}"`
    );
    expect(svg).toMatchSnapshot();
  });

  test("throws SVGParseError on invalid SVG XML", () => {
    const errFn = () =>
      prepareAccessorySVG({
        accessory: { ...accessory, svgData: "<svg" },
        index: 0,
        styles,
      });

    expect(errFn).toThrow(SVGParseError);
    expect(errFn).toThrow('Accessory "example"\'s SVG failed to parse');
  });

  test("throws on customised style classes without defined values", () => {
    expect(() =>
      prepareAccessorySVG({
        accessory,
        index: 0,
        styles: [],
      })
    ).toThrowError(
      'Accessory "example" has a customisable class "foo" but no style value exists for it.'
    );
  });
});

describe("composeAvatarSVG()", () => {
  test("merges avatar accessories into single SVG doc", () => {
    const avatar: ResolvedAvatar = {
      accessories: [
        {
          id: "acc_d",
          slotNumber: 30,
          customizableClasses: ["foo", "bar"],
          svgData: `\
<svg xmlns="http://www.w3.org/2000/svg">
  <rect width="5" height="6" class="foo bar baz boz" />
  <defs>
    <style>
      .foo { stroke: red }
      .boz { stroke: blue }
    </style>
  </defs>
  <g>
    <circle class="bar boz" cx="5" cy="6" r="1"/>
  </g>
  <circle class="foo" cx="2" cy="3" r="4"/>
</svg>`,
        },
        {
          id: "acc_a",
          slotNumber: 20,
          customizableClasses: ["bar", "baz"],
          svgData: `\
<svg xmlns="http://www.w3.org/2000/svg">
  <rect width="15" height="16" class="baz boz" />
  <defs>
    <style>
      .baz { stroke: orange }
      .boz { stroke: blue }
    </style>
  </defs>
  <g>
    <circle class="baz boz" cx="15" cy="16" r="11"/>
  </g>
  <circle class="baz" cx="12" cy="13" r="14"/>
</svg>`,
        },
      ],
      styles: [
        { className: "foo", fill: "red" },
        { className: "bar", fill: "#aabbcc" },
        { className: "baz", fill: "#123" },
        { className: "other", fill: "#fff" },
      ],
    };
    const svg = composeAvatarSVG({ avatar });
    // The baz class in "acc_d" is not referenced by any CSS rule, so it's not
    // rewritten.
    expect(svg.querySelector("#avatar #acc_d .baz")).toBeTruthy();
    expect(svg).toMatchSnapshot();
  });
});

test("stripWhitespaceAndComments()", () => {
  const docText = `

<svg xmlns="http://www.w3.org/2000/svg">
  <!-- Hi -->
  <style>
    .foo {
      fill: red
    }
  </style>
  <g>

  </g>
</svg>
`;
  const doc = new DOMParser().parseFromString(docText, "image/svg+xml");
  stripWhitespaceAndComments(doc);
  expect(new XMLSerializer().serializeToString(doc)).toBe(`\
<svg xmlns="http://www.w3.org/2000/svg"><style>
    .foo {
      fill: red
    }
  </style><g/></svg>`);
});
