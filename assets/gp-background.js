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
    ['55, 173, 185', '129, 137, 217', '195, 120, 183', '229, 156, 132', '129, 189, 163'],
    ['121, 184, 157', '69, 166, 189', '152, 129, 214', '220, 137, 170', '228, 176, 134'],
    ['224, 169, 121', '205, 133, 178', '139, 134, 209', '67, 169, 183', '130, 187, 160']
  ];
  const ribbonLayers = 18;
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
  let previousFrame = 0;
  // Wall-clock phase keeps the field visually continuous between pages.
  let time = Date.now() / 1000;
  const yValues = new Float64Array(count);

  const trace = values => {
    context.beginPath();
    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1) * 1.1 - 0.05) * width;
      if (i === 0) context.moveTo(x, values[i]);
      else context.lineTo(x, values[i]);
    }
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    const amplitude = Math.min(height, 950);
    bands.forEach((band, bandIndex) => {
      const phase = time * 0.036 + bandIndex * 1.7;
      const aWeight = Math.cos(phase);
      const bWeight = Math.sin(phase);
      const center = Float64Array.from(band.a, (value, i) =>
        height * band.center + amplitude * 0.105 * (value * aWeight + band.b[i] * bWeight));

      // Feathered colour layers follow the GP curves like translucent silk.
      // The palette shifts across each ribbon as well as along its length.
      const halfWidth = Float64Array.from(center, (_, i) => amplitude * (
        0.06 + 0.025 * (1 + Math.sin(i / (count - 1) * 5 + phase * 0.65 + bandIndex))
      ));
      for (let layer = 0; layer < ribbonLayers; layer++) {
        const lower = layer / ribbonLayers * 2 - 1;
        const upper = (layer + 1) / ribbonLayers * 2 - 1;
        context.fillStyle = gradients[bandIndex].ribbon[layer];
        context.globalAlpha = Math.sin(Math.PI * (layer + 0.5) / ribbonLayers) ** 0.85;
        context.beginPath();
        for (let i = 0; i < count; i++) {
          const x = (i / (count - 1) * 1.1 - 0.05) * width;
          const y = center[i] + halfWidth[i] * lower;
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        for (let i = count - 1; i >= 0; i--) {
          context.lineTo((i / (count - 1) * 1.1 - 0.05) * width, center[i] + halfWidth[i] * upper);
        }
        context.closePath();
        context.fill();
      }
      context.globalAlpha = 1;

      band.strands.forEach((strand, index) => {
        if (width < 600 && index % 2) return;
        const angle = time * 0.046 + strand.phase;
        const a = Math.cos(angle);
        const b = Math.sin(angle);
        for (let i = 0; i < count; i++) {
          yValues[i] = center[i] + amplitude * (
            strand.offset * 0.044 + (strand.a[i] * a + strand.b[i] * b) * 0.044
          );
        }
        trace(yValues);
        context.strokeStyle = gradients[bandIndex].line;
        context.lineWidth = index % 4 === 0 ? 1.4 : 0.8;
        context.globalAlpha = index % 4 === 0 ? 0.8 : 0.5;
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
        rgb.forEach((_, index) => {
          const position = (index + layer / (ribbonLayers - 1) * 1.6) % rgb.length;
          const start = Math.floor(position);
          const blend = position - start;
          const color = rgb[start].map((channel, i) => Math.round(
            channel * (1 - blend) + rgb[(start + 1) % rgb.length][i] * blend
          ));
          gradient.addColorStop(index / (rgb.length - 1), `rgba(${color.join(',')}, 0.36)`);
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
    if (!previousFrame) previousFrame = timestamp;
    const elapsed = timestamp - previousFrame;
    // A gentle background needs only 30fps, or 24fps on small screens.
    if (elapsed >= 1000 / (width < 600 ? 24 : 30)) {
      time += Math.min(elapsed, 100) / 1000;
      previousFrame = timestamp;
      draw();
    }
    frame = requestAnimationFrame(animate);
  };

  const syncMotion = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousFrame = 0;
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
