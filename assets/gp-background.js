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
  const intervalSamples = 112;
  const intervalSamplesPerRadian = 14;
  const rbf = (distance, lengthScale) => Math.exp(-0.5 * (distance / lengthScale) ** 2);
  const factor = (size, covariance, noise) => {
    const cholesky = Array.from({ length: size }, () => new Float64Array(size));
    for (let row = 0; row < size; row++) {
      for (let column = 0; column <= row; column++) {
        let value = covariance(row, column);
        if (row === column) value += noise;
        for (let k = 0; k < column; k++) value -= cholesky[row][k] * cholesky[column][k];
        cholesky[row][column] = row === column
          ? Math.sqrt(Math.max(value, 1e-12))
          : value / cholesky[column][column];
      }
    }
    return cholesky;
  };
  const makeSampler = lengthScale => {
    const cholesky = factor(count, (i, j) => rbf((i - j) / (count - 1), lengthScale), 1e-8);
    return () => {
      const noise = Float64Array.from({ length: count }, normal);
      return Float64Array.from(cholesky, (row, i) => {
        let value = 0;
        for (let j = 0; j <= i; j++) value += row[j] * noise[j];
        return value;
      });
    };
  };

  // A periodic GP uncertainty profile lets the bands travel through the loop seam.
  const makeInterval = lengthScale => {
    const period = intervalSamples / (count - 1);
    const radius = period / Math.PI;
    const kernel = (x, y) => rbf(radius * Math.sin((x - y) / radius), lengthScale);
    const anchors = Array.from({ length: 3 }, (_, i) => (i + 0.17 + 0.66 * random()) * period / 3);
    const cholesky = factor(anchors.length, (i, j) => kernel(anchors[i], anchors[j]), 0.01);
    const solved = new Float64Array(anchors.length);
    const profile = new Float64Array(intervalSamples + count);
    for (let index = 0; index < intervalSamples; index++) {
      const x = index / (count - 1);
      let variance = 1;
      for (let i = 0; i < anchors.length; i++) {
        let value = kernel(x, anchors[i]);
        for (let j = 0; j < i; j++) value -= cholesky[i][j] * solved[j];
        solved[i] = value / cholesky[i][i];
        variance -= solved[i] ** 2;
      }
      profile[index] = Math.sqrt(Math.max(0, variance));
    }
    // Duplicate the leading samples so interpolation can cross the seam.
    profile.set(profile.subarray(0, count), intervalSamples);
    return profile;
  };
  const palette = [
    ['29, 171, 192', '109, 119, 225', '190, 102, 193', '237, 146, 112', '91, 190, 154'],
    ['76, 184, 145', '36, 162, 199', '145, 108, 222', '226, 115, 166', '238, 169, 112'],
    ['235, 157, 98', '210, 108, 183', '124, 114, 221', '29, 167, 190', '94, 189, 150']
  ];
  const ribbonLayers = 12;
  const motionSpeed = 2.2;
  const flowCount = 20;
  // Each ribbon is its own GP, with a different length scale and time evolution.
  // Jittered positions spread the field across the page without shared bands.
  const flows = Array.from({ length: flowCount }, (_, index) => {
    const lengthScale = 0.1 + random() * 0.23;
    const sample = makeSampler(lengthScale);
    return {
      colors: palette[Math.floor(random() * palette.length)],
      colorShift: random() * 5,
      mean: 0.05 + (index + random()) / flowCount * 0.9,
      deviation: 0.065 + random() * 0.085,
      width: 0.009 + random() * 0.022,
      opacity: 0.26 + random() * 0.16,
      lineWidth: 0.85 + random() * 0.7,
      lineAlpha: 0.6 + random() * 0.25,
      rate: (0.026 + random() * 0.028) * (random() < 0.5 ? -1 : 1),
      phase: random() * Math.PI * 2,
      secondaryPhase: random() * Math.PI * 2,
      a: sample(),
      b: sample(),
      c: sample(),
      d: sample(),
      interval: makeInterval(0.065 + 0.2 * lengthScale),
      y: new Float64Array(count),
      spread: new Float64Array(count)
    };
  });

  let width = 0;
  let height = 0;
  let gradients = [];
  let frame = 0;
  let resizeFrame = 0;
  let previousFrame = null;
  let paintElapsed = 0;
  // Wall-clock phase keeps the field visually continuous between pages.
  let time = Date.now() / 1000;

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
    const motionTime = time * motionSpeed;
    flows.forEach((flow, flowIndex) => {
      if (width < 600 && flowIndex % 3 === 2) return;
      const phase = motionTime * flow.rate + flow.phase;
      const secondary = motionTime * flow.rate * Math.SQRT2 + flow.secondaryPhase;
      const aWeight = Math.cos(phase);
      const bWeight = Math.sin(phase);
      const cWeight = Math.cos(secondary);
      const dWeight = Math.sin(secondary);
      // A decreasing lookup offset moves the width profile to the right.
      const travel = (flow.phase - motionTime * Math.abs(flow.rate)) * intervalSamplesPerRadian;
      const offset = (travel % intervalSamples + intervalSamples) % intervalSamples;
      const start = Math.floor(offset);
      const blend = offset - start;
      const bandScale = amplitude * flow.width;
      const center = flow.y;
      const halfWidth = flow.spread;
      for (let i = 0; i < count; i++) {
        // Independent GP draws at two time scales avoid a shared looping sway.
        // The 0.8/0.6 weights preserve the samples' unit variance.
        center[i] = height * flow.mean + amplitude * flow.deviation * (
          0.8 * (flow.a[i] * aWeight + flow.b[i] * bWeight) +
          0.6 * (flow.c[i] * cWeight + flow.d[i] * dWeight)
        );
        const uncertainty = flow.interval[i + start] * (1 - blend) + flow.interval[i + start + 1] * blend;
        // Leave a soft edge at each pinch and let the gaps fan out further.
        halfWidth[i] = bandScale * (0.055 + 1.59 * uncertainty);
      }
      for (let layer = 0; layer < ribbonLayers; layer++) {
        const lower = layer / ribbonLayers * 2 - 1;
        const upper = (layer + 1) / ribbonLayers * 2 - 1;
        context.fillStyle = gradients[flowIndex].ribbon[layer];
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
      trace(center);
      context.strokeStyle = gradients[flowIndex].line;
      context.lineWidth = flow.lineWidth;
      context.globalAlpha = flow.lineAlpha;
      context.stroke();
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
    gradients = flows.map(flow => {
      const rgb = flow.colors.map(color => color.split(',').map(Number));
      const colorAt = position => {
        const wrapped = position % rgb.length;
        const start = Math.floor(wrapped);
        const blend = wrapped - start;
        return rgb[start].map((channel, i) => Math.round(
          channel * (1 - blend) + rgb[(start + 1) % rgb.length][i] * blend
        )).join(',');
      };
      const line = context.createLinearGradient(0, 0, width, height * 0.25);
      rgb.forEach((_, index) => {
        line.addColorStop(index / (rgb.length - 1), `rgba(${colorAt(index + flow.colorShift + 0.4)}, 0.85)`);
      });
      const ribbon = Array.from({ length: ribbonLayers }, (_, layer) => {
        const gradient = context.createLinearGradient(0, 0, width, height * 0.3);
        rgb.forEach((_, index) => {
          const color = colorAt(index + flow.colorShift + layer / (ribbonLayers - 1) * 0.8);
          gradient.addColorStop(index / (rgb.length - 1), `rgba(${color}, ${flow.opacity})`);
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
