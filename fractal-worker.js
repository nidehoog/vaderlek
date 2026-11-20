function clamp255(v) {
  return v < 0 ? 0 : (v > 255 ? 255 : v);
}

self.onmessage = function (event) {
  const d = event.data;
  const width = d.width;
  const height = d.height;
  const yStart = d.yStart;
  const yEnd = d.yEnd;
  const centerX = d.centerX;
  const centerY = d.centerY;
  const spanX = d.spanX;
  const spanY = d.spanY;
  const maxIter = d.maxIter;
  const token = d.token;
  const palette = d.palette;

  const rowCount = yEnd - yStart;
  const pixels = new Uint8ClampedArray(width * rowCount * 4);

  let p = 0;
  for (let py = yStart; py < yEnd; py++) {
    const cy = centerY + (py / height - 0.5) * spanY;

    for (let px = 0; px < width; px++) {
      const cx = centerX + (px / width - 0.5) * spanX;

      let zx = 0.0;
      let zy = 0.0;
      let zx2 = 0.0;
      let zy2 = 0.0;
      let iter = 0;

      while (zx2 + zy2 <= 4.0 && iter < maxIter) {
        zy = 2.0 * zx * zy + cy;
        zx = zx2 - zy2 + cx;
        zx2 = zx * zx;
        zy2 = zy * zy;
        iter++;
      }

      let r = 0;
      let g = 0;
      let b = 0;

      if (iter < maxIter) {
        const mag2 = zx2 + zy2;
        const logZn = Math.log(mag2) * 0.5;
        const nu = Math.log(Math.max(logZn / Math.log(2), 1e-12)) / Math.log(2);
        const smooth = iter + 1 - nu;

        // Endast sex huvudsakliga färger används per tema.
        const band = Math.floor(smooth * 0.075);
        const color = palette[band % palette.length];

        // Mild ljusvariation ger djup utan att lägga till fler kulörer.
        const brightness = 0.48 + 0.52 * Math.min(1, smooth / 85);

        r = clamp255(color[0] * brightness);
        g = clamp255(color[1] * brightness);
        b = clamp255(color[2] * brightness);
      }

      pixels[p++] = r | 0;
      pixels[p++] = g | 0;
      pixels[p++] = b | 0;
      pixels[p++] = 255;
    }
  }

  self.postMessage({ width, height, token, yStart, buffer: pixels.buffer }, [pixels.buffer]);
};

