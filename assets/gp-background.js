(() => {
  'use strict';

  // A decorative field of Gaussian-process draws, shared by every page.
  // Sampling happens once; each frame only blends the precomputed curves.
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.className = 'gp-background';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motionPreference.matches;

  // Seeded normals give the same visual identity on every page, without assets
  // or a rendering library. The RBF kernel makes the paths smoothly correlated.
  let seed = 20261110;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return (seed + 1) / 4294967297;
  };
  const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  const count = 96;
  const kernel = (x, y) => Math.exp(-0.5 * ((x - y) / 0.23) ** 2);
  const cholesky = Array.from({ length: count }, () => new Float64Array(count));
  for (let row = 0; row < count; row++) {
    for (let column = 0; column <= row; column++) {
      let value = kernel(row / (count - 1), column / (count - 1));
      if (row === column) value += 1e-8;
      for (let k = 0; k < column; k++) value -= cholesky[row][k] * cholesky[column][k];
      cholesky[row][column] = row === column
        ? Math.sqrt(Math.max(value, 1e-12))
        : value / cholesky[column][column];
    }
  }
  const sample = () => {
    const noise = Float64Array.from({ length: count }, normal);
    return Float64Array.from(cholesky, (row, i) => {
      let value = 0;
      for (let j = 0; j <= i; j++) value += row[j] * noise[j];
      return value;
    });
  };
  const palette = [
    ['16, 164, 190', '93, 103, 223', '190, 82, 187', '241, 133, 96', '63, 181, 139'],
    ['49, 178, 129', '20, 152, 199', '137, 87, 222', '229, 94, 156', '242, 158, 91'],
    ['240, 145, 77', '212, 87, 177', '111, 94, 220', '15, 160, 189', '65, 180, 135']
  ];
  const ribbonLayers = 64;
  const shimmerLayers = 24;
  const motionSpeed = 1.45;
  const bands = palette.map((colors, band) => ({
    colors,
    center: 0.22 + band * 0.29,
    a: sample(),
    b: sample(),
    strands: Array.from({ length: 12 }, (_, i) => ({
      a: sample(),
      b: sample(),
      offset: (i - 5.5) / 5.5,
      phase: random() * Math.PI * 2
    }))
  }));

  let width = 0;
  let height = 0;
  let gradients = [];
  let frame = 0;
  let resizeFrame = 0;
  let previousFrame = null;
  let paintElapsed = 0;
  // Wall-clock phase keeps the field visually continuous between pages.
  let time = Date.now() / 1000;
  const yValues = new Float64Array(count);

  const trace = values => {
    context.beginPath();
    context.moveTo(-0.05 * width, values[0]);
    for (let i = 1; i < count - 1; i++) {
      const x = (i / (count - 1) * 1.1 - 0.05) * width;
      const nextX = ((i + 1) / (count - 1) * 1.1 - 0.05) * width;
      context.quadraticCurveTo(x, values[i], (x + nextX) / 2, (values[i] + values[i + 1]) / 2);
    }
    context.lineTo(1.05 * width, values[count - 1]);
  };

  const fillSurface = (surface, lower, upper) => {
    context.beginPath();
    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1) * 1.1 - 0.05) * width;
      const y = surface(i, lower);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    for (let i = count - 1; i >= 0; i--) {
      context.lineTo((i / (count - 1) * 1.1 - 0.05) * width, surface(i, upper));
    }
    context.closePath();
    context.fill();
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    const amplitude = Math.min(height, 950);
    const motionTime = time * motionSpeed;
    bands.forEach((band, bandIndex) => {
      const phase = motionTime * 0.036 + bandIndex * 1.7;
      const aWeight = Math.cos(phase);
      const bWeight = Math.sin(phase);
      const center = Float64Array.from(band.a, (value, i) =>
        height * band.center + amplitude * (
          0.105 * (value * aWeight + band.b[i] * bWeight) +
          // A small travelling swell gives the field a continuous liquid flow.
          0.014 * Math.sin(i / (count - 1) * Math.PI * 2 - motionTime * 0.09 + bandIndex * 1.2)
        ));

      // A travelling fold bends the whole surface, including its satin sheen.
      // Soft light and shadow across the cloth give depth without hard edges.
      const halfWidth = Float64Array.from(center, (_, i) => amplitude * (
        0.081 + 0.03375 * (1 + Math.sin(i / (count - 1) * 5 - motionTime * 0.07 + bandIndex))
      ));
      const fold = Float64Array.from(center, (_, i) =>
        0.17 * Math.sin(i / (count - 1) * 5.5 - motionTime * 0.08 + bandIndex * 0.9));
      const surface = (i, position) => center[i] + halfWidth[i] * (
        position + (1 - position * position) * fold[i]
      );
      for (let layer = 0; layer < ribbonLayers; layer++) {
        const lower = layer / ribbonLayers * 2 - 1;
        const upper = (layer + 1) / ribbonLayers * 2 - 1;
        context.fillStyle = gradients[bandIndex].ribbon[layer];
        context.globalAlpha = Math.sin(Math.PI * (layer + 0.5) / ribbonLayers) ** 0.85;
        fillSurface(surface, lower, upper);
      }

      // A broad, feathered glint travels along the fold in about 20 seconds.
      // Periodic light avoids a visible reset and staggers the three ribbons.
      const shimmer = context.createLinearGradient(-0.05 * width, 0, 1.05 * width, 0);
      const shimmerStrength = width < 600 ? 0.2 : 0.28;
      for (let stop = 0; stop <= 32; stop++) {
        const along = stop / 32;
        const light = (1 + Math.cos(along * Math.PI * 2 - motionTime * 0.22 - bandIndex * 1.9)) / 2;
        shimmer.addColorStop(along, `rgba(255, 253, 250, ${shimmerStrength * light ** 6})`);
      }
      context.fillStyle = shimmer;
      for (let layer = 0; layer < shimmerLayers; layer++) {
        const lower = -0.58 + layer / shimmerLayers * 0.88;
        const upper = -0.58 + (layer + 1) / shimmerLayers * 0.88;
        const across = (lower + upper) / 2;
        context.globalAlpha = Math.exp(-(((across + 0.14) / 0.2) ** 2));
        fillSurface(surface, lower, upper);
      }
      context.globalAlpha = 1;

      band.strands.forEach((strand, index) => {
        if (index % (width < 600 ? 4 : 2)) return;
        const angle = motionTime * 0.046 + strand.phase;
        const a = Math.cos(angle);
        const b = Math.sin(angle);
        for (let i = 0; i < count; i++) {
          yValues[i] = surface(i, strand.offset * 0.72) + amplitude *
            (strand.a[i] * a + strand.b[i] * b) * 0.008;
        }
        trace(yValues);
        context.strokeStyle = gradients[bandIndex].line;
        context.lineWidth = 1.2;
        context.globalAlpha = 0.16;
        context.stroke();
      });
      context.globalAlpha = 1;
    });
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineJoin = 'round';
    gradients = bands.map(band => {
      const line = context.createLinearGradient(0, 0, width, height * 0.25);
      band.colors.forEach((color, index) => {
        line.addColorStop(index / (band.colors.length - 1), `rgba(${color}, 0.8)`);
      });
      const rgb = band.colors.map(color => color.split(',').map(Number));
      const ribbon = Array.from({ length: ribbonLayers }, (_, layer) => {
        const gradient = context.createLinearGradient(0, 0, width, height * 0.3);
        const positionAcross = (layer + 0.5) / ribbonLayers * 2 - 1;
        const sheen = 0.76 * Math.exp(-(((positionAcross + 0.24) / 0.18) ** 2))
          + 0.24 * Math.exp(-(((positionAcross - 0.68) / 0.16) ** 2));
        const shadow = 0.28 * Math.exp(-(((positionAcross - 0.22) / 0.28) ** 2));
        rgb.forEach((_, index) => {
          const position = (index + layer / (ribbonLayers - 1) * 1.25) % rgb.length;
          const start = Math.floor(position);
          const blend = position - start;
          const color = rgb[start].map((channel, i) => {
            const base = channel * (1 - blend) + rgb[(start + 1) % rgb.length][i] * blend;
            return Math.round(base * (1 - shadow) + (255 - base) * sheen);
          });
          gradient.addColorStop(index / (rgb.length - 1), `rgba(${color.join(',')}, 0.58)`);
        });
        return gradient;
      });
      return { line, ribbon };
    });
    draw();
  };

  const animate = timestamp => {
    frame = 0;
    if (paused || document.hidden) return;
    const elapsed = previousFrame === null ? 0 : Math.min(timestamp - previousFrame, 100);
    previousFrame = timestamp;
    time += elapsed / 1000;
    paintElapsed += elapsed;
    // Keep motion independent of refresh rate and retain fractional frame time.
    // 60fps makes the ribbons fluid; phones use a lighter 30fps budget.
    const interval = 1000 / (width < 600 ? 30 : 60);
    if (paintElapsed >= interval - 0.5) {
      paintElapsed = Math.max(0, paintElapsed - interval);
      if (paintElapsed >= interval) paintElapsed %= interval;
      draw();
    }
    frame = requestAnimationFrame(animate);
  };

  const syncMotion = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousFrame = null;
    paintElapsed = 0;
    if (!paused && !document.hidden) frame = requestAnimationFrame(animate);
  };

  motionPreference.addEventListener('change', event => {
    paused = event.matches;
    syncMotion();
  });
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(resizeFrame);
    frame = 0;
  });
  window.addEventListener('pageshow', syncMotion);
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resize);
  }, { passive: true });

  resize();
  syncMotion();
})();
