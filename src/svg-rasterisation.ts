import { assert } from "./assert";

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
}: {
  svg: SVGElement;
  width: number;
  height: number;
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
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
