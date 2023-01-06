import { assert } from "./assert";
import { SVGNS } from "./svg";

interface RasteriseSVGOptions {
  svg: SVGElement;
  width: number;
  height: number;
}

/**
 * Draw the SVG image on a canvas, returning a Blob containing a PNG image.
 *
 * The width and height is the size of the resulting image. The SVG element
 * should be styled to fill the width x height area, e.g. via a viewBox with the
 * same aspect ratio, or explicit width and height set to the same values.
 */
export async function rasteriseSVG({
  svg,
  width,
  height,
}: RasteriseSVGOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  svg = wrapSvgWithAbsoluteDimensionsIfRequired({ svg, width, height });
  const renderContext = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
    willReadFrequently: false,
  });
  assert(renderContext);
  // The default is low, but there doesn't appear to by any difference in
  // practice.
  renderContext.imageSmoothingEnabled = true;
  renderContext.imageSmoothingQuality = "high";
  renderContext.clearRect(0, 0, canvas.width, canvas.height);

  const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: "image/svg+xml",
  });
  const svgBlobURL = URL.createObjectURL(svgBlob);
  let svgImage: HTMLImageElement;
  try {
    svgImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onabort = reject;
      image.onerror = reject;
      image.onload = () => {
        resolve(image);
      };
      image.src = svgBlobURL;
    });
  } finally {
    URL.revokeObjectURL(svgBlobURL);
  }
  renderContext.drawImage(svgImage, 0, 0);

  const result = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  assert(result !== null);
  return result;
}

function wrapSvgWithAbsoluteDimensionsIfRequired({
  svg,
  width,
  height,
}: RasteriseSVGOptions): SVGElement {
  if (!HeadgearGlobal.FEATURE_CANVAS_SVG_ABSOLUTE_DIMENSIONS) {
    return svg;
  }

  // Firefox renders SVG on a canvas with 0x0 size unless it has absolute width
  // and height: https://bugzilla.mozilla.org/show_bug.cgi?id=700533
  const wrapper = document.createElementNS(SVGNS, "svg") as SVGElement;
  wrapper.setAttribute("width", `${width}`);
  wrapper.setAttribute("height", `${height}`);
  wrapper.appendChild(wrapper.ownerDocument.importNode(svg, true));
  return wrapper;
}
