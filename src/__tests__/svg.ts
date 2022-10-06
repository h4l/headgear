import { assert } from "../assert";
import {
  NFTInfo,
  ResolvedAccessory,
  ResolvedAvatar,
  SVGStyle,
} from "../avatars";
import {
  PrefixedCSSSelector,
  PrefixedCSSStylesheet,
  SVGParseError,
  _nftNameSVG,
  addPrefixesToCSSSelectorClasses,
  addPrefixesToCSSStylesheetSelectorClasses,
  addPrefixesToElementClassAttribute,
  addPrefixesToSVGClassAttributes,
  composeAvatarSVG,
  createAccessoryCustomisationCSSRules,
  createNFTCardAvatarSVG,
  createStandardAvatarSVG,
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

describe("createAccessoryCustomisationCSSRules()", () => {
  test("creates CSS from styles", () => {
    expect(
      createAccessoryCustomisationCSSRules({
        accessories: [
          { ...accessory, customizableClasses: ["foo", "bar"] },
          { ...accessory, customizableClasses: ["bar", "baz"] },
        ],

        styles: [
          { className: "foo", fill: "#fff" },
          { className: "bar", fill: "#aaa" },
          { className: "baz", fill: "#000" },
        ],
      })
    ).toBe(".color-foo{fill:#fff}.color-bar{fill:#aaa}.color-baz{fill:#000}");
  });

  test("throws if accessories use customisation class not provided in styles", () => {
    expect(() =>
      createAccessoryCustomisationCSSRules({
        accessories: [{ ...accessory, customizableClasses: ["foo", "bar"] }],
        styles: [{ className: "foo", fill: "#fff" }],
      })
    ).toThrowError(`Customisation class "bar" is used by an avatar accessory \
but has no style value.`);
  });

  test("throws if styles use unexpected properties", () => {
    const triggerFn = () =>
      createAccessoryCustomisationCSSRules({
        accessories: [{ ...accessory, customizableClasses: ["foo"] }],
        styles: [
          {
            className: "foo",
            fill: "#fff",
            unsupportedThing: "unsupported value",
          } as SVGStyle,
        ],
      });
    expect(triggerFn).toThrowError(
      "Customisation style object contains unsupported properties:"
    );
    expect(triggerFn).toThrowError('"unsupported value"');
  });
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
    <rect width="5" height="6" class="foo bar baz color-boz" />
    <defs>
      <circle class="" cx="0" cy="0" r="2"/>
      <circle class="color-boz" cx="5" cy="6" r="1"/>
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
    });
    expect(stylesheet).toMatchInlineSnapshot(
      `".example-foo{stroke:#fff;}.example-bar,.example-baz{stroke:#000;}"`
    );
    expect(svg).toMatchSnapshot();
  });

  test("throws SVGParseError on invalid SVG XML", () => {
    const errFn = () =>
      prepareAccessorySVG({
        accessory: { ...accessory, svgData: "<svg" },
        index: 0,
      });

    expect(errFn).toThrow(SVGParseError);
    expect(errFn).toThrow('Accessory "example"\'s SVG failed to parse');
  });
});

function avatar(): ResolvedAvatar {
  return {
    accessories: [
      {
        id: "accessory-b",
        slotNumber: 30,
        customizableClasses: ["xxx", "yyy"],
        svgData: `\
<svg xmlns="http://www.w3.org/2000/svg">
<rect width="5" height="6" class="foo bar baz color-xxx" />
<defs>
  <style>
    .foo { stroke: red }
    .boz { stroke: blue }
  </style>
</defs>
<g>
  <circle class="bar color-yyy" cx="5" cy="6" r="1"/>
</g>
<circle class="foo" cx="2" cy="3" r="4"/>
</svg>`,
      },
      {
        id: "accessory-a",
        slotNumber: 20,
        customizableClasses: ["yyy"],
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
  <circle class="foo baz boz color-yyy" cx="15" cy="16" r="11"/>
</g>
<circle class="baz" cx="12" cy="13" r="14"/>
</svg>`,
      },
    ],
    styles: [
      { className: "xxx", fill: "red" },
      { className: "yyy", fill: "#aabbcc" },
      // styles that aren't used by accessories can exist
      { className: "zzz", fill: "#111111" },
    ],
    nftInfo: {
      serialNumber: "123",
      seriesSize: 600,
      name: "Example Avatar",
      backgroundImage: {
        httpUrl: "https://example.com/foo.png",
        dataUrl: "data:image/png;base64,cG5nCg",
      },
    },
  };
}

describe("composeAvatarSVG()", () => {
  test("merges avatar accessories into single SVG doc", () => {
    const svg = composeAvatarSVG({ avatar: avatar() });
    // The baz class in "accessory-b" is not referenced by any CSS rule, so it's
    // not rewritten.
    expect(svg.querySelectorAll(".baz").length).toBe(1);
    expect(svg.querySelectorAll("#avatar #accessory-b .baz").length).toBe(1);
    // Similarly, the color- classes are not referenced and not rewritten.
    // Although this could be a problem if an internal style also referenced
    // a colour- customisation class, as currently that would namespace the
    // class, preventing it receiving the global customisation style.
    expect(svg.querySelectorAll(".color-xxx").length).toBe(1);
    expect(svg.querySelectorAll(".color-yyy").length).toBe(2);
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

describe("Avatar SVG", () => {
  describe("Standard Layout - createStandardAvatarSVG()", () => {
    test("renders avatar in styled container", () => {
      const composedAvatar = composeAvatarSVG({ avatar: avatar() });
      const standardLayout = createStandardAvatarSVG({ composedAvatar });
      expect(standardLayout.querySelector("#avatar")).toBeTruthy();
      expect(standardLayout.querySelector("#reddit-logo")).toBeTruthy();
      expect(standardLayout).toMatchSnapshot();
    });
  });

  describe("NFT Card Layout - createNFTCardAvatarSVG()", () => {
    test.each`
      seriesSize | renderedSeriesSize | nftType
      ${null}    | ${null}            | ${"free"}
      ${1000}    | ${"1k"}            | ${"regular"}
    `(
      "renders $nftType NFT avatar in styled container (seriesSize $seriesSize)",
      ({
        seriesSize,
        renderedSeriesSize,
      }: {
        seriesSize: null | number;
        renderedSeriesSize: null | string;
      }) => {
        const _avatar = avatar();
        assert(_avatar.nftInfo);
        const composedAvatar = composeAvatarSVG({ avatar: _avatar });
        const nftCard = createNFTCardAvatarSVG({
          composedAvatar,
          nftInfo: {
            ..._avatar.nftInfo,
            seriesSize: seriesSize,
          },
        });

        if (renderedSeriesSize === null) {
          expect(nftCard.querySelector("#series-size")).toBeFalsy();
        } else {
          expect(nftCard.querySelector("#series-size")?.textContent).toEqual(
            renderedSeriesSize
          );
        }
        expect(nftCard).toMatchSnapshot();
      }
    );

    test.each`
      seriesSize | renderedSeriesSize
      ${null}    | ${null}
      ${600}     | ${"600"}
      ${1000}    | ${"1k"}
      ${1200}    | ${"1.2k"}
      ${1289}    | ${"1.3k"}
    `(
      "nftNameSVG() renders seriesSize $seriesSize",
      ({
        seriesSize,
        renderedSeriesSize,
      }: {
        seriesSize: null | number;
        renderedSeriesSize: null | string;
      }) => {
        const _avatar = avatar();
        assert(_avatar.nftInfo);
        const nftInfo: NFTInfo = {
          ..._avatar.nftInfo,
          seriesSize: seriesSize,
        };
        const nftName = _nftNameSVG(nftInfo);

        if (renderedSeriesSize === null) {
          expect(nftName.querySelector("#series-size")).toBeFalsy();
        } else {
          expect(nftName.querySelector("#series-size")?.textContent).toEqual(
            renderedSeriesSize
          );
        }
      }
    );
  });
});
