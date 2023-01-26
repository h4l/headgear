import { AssertionError, assert } from "../assert";
import {
  NFTInfo,
  ResolvedAccessory,
  ResolvedAvatar,
  SVGStyle,
} from "../avatars";
import {
  NFTCardVariant,
  PrefixedCSSSelector,
  PrefixedCSSStylesheet,
  SVGNS,
  SVGParseError,
  _internals,
  _nftNameSVG,
  parseSVG as _parseSVG,
  addPrefixesToCSSSelectorClasses,
  addPrefixesToCSSStylesheetSelectorClasses,
  addPrefixesToElementClassAttribute,
  addPrefixesToSVGClassAttributes,
  composeAvatarSVG,
  createAccessoryCustomisationCSSRules,
  createDistinctAccessoryIds,
  createHeadshotCircleAvatarSVG,
  createHeadshotCommentsAvatarSVG,
  createNFTCardAvatarSVG,
  createStandardAvatarSVG,
  prepareAccessorySVG,
  safeId,
  stripWhitespaceAndComments,
} from "../svg";

jest.mock("../text-to-path");
jest.mock("../text-to-path/font-loading");

function parseSVG(svg: string): SVGElement {
  return _parseSVG({ svgSource: svg });
}

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

  test("allows accessories to use customisation class not provided in styles", () => {
    expect(() =>
      // When using the randomise feature in the Reddit avatar builder, style
      // values are not always set.
      createAccessoryCustomisationCSSRules({
        accessories: [{ ...accessory, customizableClasses: ["foo", "bar"] }],
        styles: [{ className: "foo", fill: "#fff" }],
      })
    ).not.toThrowError();
  });

  test("allows customisation styles not used in accessories", () => {
    expect(() =>
      // Customised colours can remain when no active accessories use them.
      createAccessoryCustomisationCSSRules({
        accessories: [{ ...accessory, customizableClasses: ["foo"] }],
        styles: [
          { className: "foo", fill: "#fff" },
          { className: "bar", fill: "#fff" },
        ],
      })
    ).not.toThrowError();
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
      // Accessories (like hair) can be made up of multiple layers, which have
      // different layer orders (slotNumber), but share the same id.
      // `accessory-b` is such a two-part accessory, this is a foreground layer:
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
      // This is the background layer of a two-part accessory:
      {
        id: "accessory-b",
        slotNumber: 10,
        customizableClasses: [],
        svgData: `\
<svg xmlns="http://www.w3.org/2000/svg">
<rect width="5" height="6" class="foo" />
<defs>
  <style>
    .foo { stroke: DeepPink }
    .boz { stroke: DeepBlue }
  </style>
</defs>
<g>
  <circle class="boz" cx="4.5" cy="4.5" r="1"/>
</g>
<circle class="foo" cx="2.5" cy="3.5" r="4"/>
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
      nftId: "nft_eip155:123_0000000000000000000000000000000000000000_0",
      seriesSize: 600,
      name: "Example Avatar #123",
      backgroundImage: {
        httpUrl: "https://example.com/foo.png",
        dataUrl: "data:image/png;base64,cG5nCg",
      },
    },
  };
}

describe("createDistinctAccessoryIds()", () => {
  test("assigns unique ids to accessories with multiple layers and multiple layers per-slot", () => {
    const accessories: ResolvedAccessory[] = [
      { id: "thing_a", slotNumber: 10, customizableClasses: [], svgData: "" },
      { id: "thing_b", slotNumber: 20, customizableClasses: [], svgData: "" },
      // Multiple instances of the same accessory at the same layer position.
      // Probably never happens in practice, but we handle this by including the
      // index in the ID if it does.
      { id: "thing_a", slotNumber: 30, customizableClasses: [], svgData: "" },
      { id: "thing_a", slotNumber: 30, customizableClasses: [], svgData: "" },
    ];
    const distinctIds = createDistinctAccessoryIds(accessories);
    expect(new Set(distinctIds).size).toEqual(accessories.length);
    expect(distinctIds).toMatchInlineSnapshot(`
      [
        "thing_a_10",
        "thing_b",
        "thing_a_30_2",
        "thing_a_30_3",
      ]
    `);
  });
});

describe("composeAvatarSVG()", () => {
  test("merges avatar accessories into single SVG doc", () => {
    const svg = composeAvatarSVG({ avatar: avatar() });
    // The baz class in "accessory-b", slot 30 is not referenced by any CSS
    //  rule, so it's not rewritten.
    expect(svg.querySelectorAll(".baz").length).toBe(1);
    expect(svg.querySelectorAll("#avatar #accessory-b_30 .baz").length).toBe(1);
    // Similarly, the color- classes are not referenced and not rewritten.
    // Although this could be a problem if an internal style also referenced
    // a colour- customisation class, as currently that would namespace the
    // class, preventing it receiving the global customisation style.
    expect(svg.querySelectorAll(".color-xxx").length).toBe(1);
    expect(svg.querySelectorAll(".color-yyy").length).toBe(2);
    expect(svg).toMatchSnapshot();
  });

  test("applies dubbl3bee recursion", () => {
    const av = avatar();
    const body = { ...av.accessories[0], id: "dubbl3bee_body_001" };
    av.accessories = [av.accessories[0], body, ...av.accessories.slice(1)];
    const svg = composeAvatarSVG({ avatar: av });
    const avatarGroup = svg.querySelector("#avatar");
    assert(avatarGroup);
    expect(avatarGroup.children.length).toBe(6);
    expect(avatarGroup.children[0].id).toBe("avatar-lower");
    expect(avatarGroup.children[0].id).toBe("avatar-lower");
    expect(Array.from(avatarGroup.children).slice(1, 5)).toMatchSnapshot();
    expect(avatarGroup.children[5].id).toBe("avatar-upper");
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
      async ({
        seriesSize,
        renderedSeriesSize,
      }: {
        seriesSize: null | number;
        renderedSeriesSize: null | string;
      }) => {
        const _avatar = avatar();
        assert(_avatar.nftInfo);
        const composedAvatar = composeAvatarSVG({ avatar: _avatar });
        const nftCard = await createNFTCardAvatarSVG({
          composedAvatar,
          nftInfo: { ..._avatar.nftInfo, seriesSize },
          variant: NFTCardVariant.SHOP_INVENTORY,
        });

        if (renderedSeriesSize === null) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(nftCard.querySelector("#series-size")).toBeFalsy();
        } else {
          // eslint-disable-next-line jest/no-conditional-expect
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
      async ({
        seriesSize,
        renderedSeriesSize,
      }: {
        seriesSize: null | number;
        renderedSeriesSize: null | string;
      }) => {
        const _avatar = avatar();
        assert(_avatar.nftInfo);
        const nftInfo: NFTInfo = { ..._avatar.nftInfo, seriesSize };
        const nftName = await _nftNameSVG({
          nftInfo,
          variant: NFTCardVariant.SHOP_INVENTORY,
        });

        if (renderedSeriesSize === null) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(nftName.querySelector("#series-size")).toBeFalsy();
        } else {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(nftName.querySelector("#series-size")?.textContent).toEqual(
            renderedSeriesSize
          );
        }
      }
    );
  });

  describe("Headshot Circle Layout - createHeadshotCircleAvatarSVG()", () => {
    const _getBBox = SVGGraphicsElement.prototype.getBBox;
    beforeEach(() => {
      SVGGraphicsElement.prototype.getBBox = jest.fn().mockReturnValue({
        x: 10,
        y: 100,
        width: 350,
        height: 470,
      } as Partial<DOMRect> as DOMRect);
    });
    afterEach(() => {
      SVGGraphicsElement.prototype.getBBox = _getBBox;
    });

    test("renders avatar in styled container", () => {
      const composedAvatar = composeAvatarSVG({ avatar: avatar() });
      const layout = createHeadshotCircleAvatarSVG({ composedAvatar });
      expect(layout.querySelector("#avatar")).toBeTruthy();
      expect(layout).toMatchSnapshot();
    });
  });

  describe("Headshot Comments Layout - createHeadshotCommentsAvatarSVG()", () => {
    const _getBBox = SVGGraphicsElement.prototype.getBBox;
    beforeEach(() => {
      SVGGraphicsElement.prototype.getBBox = jest.fn().mockReturnValue({
        x: 10,
        y: 100,
        width: 350,
        height: 470,
      } as Partial<DOMRect> as DOMRect);
    });
    afterEach(() => {
      SVGGraphicsElement.prototype.getBBox = _getBBox;
    });

    test("renders avatar in styled container", () => {
      const composedAvatar = composeAvatarSVG({ avatar: avatar() });
      const layout = createHeadshotCommentsAvatarSVG({ composedAvatar });
      expect(layout.querySelector("#avatar")).toBeTruthy();
      expect(layout).toMatchSnapshot();
    });
  });
});

describe("_internals", () => {
  test("parseViewBox()", () => {
    expect(
      _internals.parseViewBox(
        parseSVG(`<svg xmlns="${SVGNS}" viewBox="-10 20 12.2 30"/>`)
      )
    ).toEqual({ x: -10, y: 20, w: 12.2, h: 30 });
    expect(() =>
      _internals.parseViewBox(parseSVG(`<svg xmlns="${SVGNS}"/>`))
    ).toThrow("el has no viewBox attribute");
    expect(() =>
      _internals.parseViewBox(
        parseSVG(`<svg xmlns="${SVGNS}" viewBox="-10 20 12.2 foo"/>`)
      )
    ).toThrow("invalid viewBox: -10 20 12.2 foo");
  });

  test("getAbsolutePosition()", () => {
    const svg = parseSVG(`
    <svg xmlns="${SVGNS}" viewBox="-10 20 20 30">
      <text id="a" x="5" y="50%"/>
      <text id="b" x="50%" y="100"/>
      <g>
        <text id="c" x="100%"/>
      </g>
    </svg>`);
    const a = svg.querySelector("#a");
    const b = svg.querySelector("#b");
    const c = svg.querySelector("#c");
    assert(a && b && c);
    expect(_internals.getAbsolutePosition(a, "x")).toEqual(5);
    expect(_internals.getAbsolutePosition(a, "y")).toEqual(35);
    expect(_internals.getAbsolutePosition(b, "x")).toEqual(0);
    expect(_internals.getAbsolutePosition(b, "y")).toEqual(100);
    expect(() => _internals.getAbsolutePosition(c, "x")).toThrow(
      AssertionError
    );
    expect(() => _internals.getAbsolutePosition(c, "y")).toThrow(
      "el has no y attribute"
    );
  });
});
