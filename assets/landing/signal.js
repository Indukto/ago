(() => {
  const canvas = document.querySelector("[data-signal-canvas]");
  const toggle = document.querySelector("[data-signal-toggle]");
  const copyButton = document.querySelector("[data-copy-variation]");
  const status = document.querySelector("[data-signal-status]");

  if (!canvas || !toggle) return;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const settings = {
    cells: 93,
    bands: 6,
    wave: 0.45,
    tiltDegrees: -24,
    detail: 1,
    amount: 1.55,
    fps: 12,
    loopFrames: 36,
  };
  const frameInterval = 1000 / settings.fps;
  const loopDuration = frameInterval * settings.loopFrames;
  const angle = (settings.tiltDegrees * Math.PI) / 180;
  const loopRadians = Math.PI * 2;
  let width = 0;
  let height = 0;
  let frame = 0;
  let lastFrame = 0;
  let lastTick = 0;
  let elapsed = 0;
  let phase = 0;
  let inView = true;
  let playing = !motionPreference.matches;
  let backgroundCanvas = document.createElement("canvas");
  let backgroundContext = backgroundCanvas.getContext("2d", { alpha: false });

  const makeNoise = (column, row, offset = 0) => {
    return (Math.sin((column + 7 + offset) * 127.1 + (row + 3) * 311.7) + 1) * 0.5;
  };

  const drawBackground = () => {
    if (!backgroundContext || !width || !height) return;

    backgroundCanvas.width = Math.max(1, Math.ceil(width));
    backgroundCanvas.height = Math.max(1, Math.ceil(height));
    backgroundContext = backgroundCanvas.getContext("2d", { alpha: false });
    if (!backgroundContext) return;

    backgroundContext.fillStyle = "#0000ff";
    backgroundContext.fillRect(0, 0, width, height);

    const columns = settings.cells * 3;
    const rows = Math.round((settings.cells * 9) / 16) * 3;
    const dotStepX = width / columns;
    const dotStepY = height / rows;
    backgroundContext.fillStyle = "#ffffff";

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const grain = makeNoise(column, row, 19);
        if (grain < 0.38) continue;

        backgroundContext.globalAlpha = 0.05 + grain * 0.1;
        backgroundContext.fillRect(column * dotStepX, row * dotStepY, 1, 1);
      }
    }

    backgroundContext.globalAlpha = 1;
  };

  const drawMark = (column, row, type, noise, fieldStrength) => {
    const cellWidth = width / settings.cells;
    const cellHeight = height / Math.round((settings.cells * 9) / 16);
    const originX = column * cellWidth;
    const originY = row * cellHeight;
    const inset = cellWidth * 0.12;
    const left = originX + inset;
    const top = originY + cellHeight * 0.12;
    const markWidth = cellWidth - inset * 2;
    const markHeight = cellHeight * 0.76;
    const weight = cellWidth * (0.085 + Math.min(fieldStrength, 1) * 0.025);

    context.fillStyle = "#ffffff";
    context.strokeStyle = "#ffffff";
    context.lineWidth = weight;
    context.lineCap = "square";
    context.lineJoin = "miter";

    if (type === "diamond") {
      const centerX = originX + cellWidth * 0.5;
      const centerY = originY + cellHeight * 0.5;
      const radiusX = markWidth * (0.38 + noise * 0.08);
      const radiusY = markHeight * (0.4 + noise * 0.06);
      context.beginPath();
      context.moveTo(centerX, centerY - radiusY);
      context.lineTo(centerX + radiusX, centerY);
      context.lineTo(centerX, centerY + radiusY);
      context.lineTo(centerX - radiusX, centerY);
      context.closePath();
      context.fill();
      return;
    }

    if (type === "cross") {
      context.beginPath();
      context.moveTo(left, top);
      context.lineTo(left + markWidth, top + markHeight);
      context.moveTo(left + markWidth, top);
      context.lineTo(left, top + markHeight);
      context.stroke();
      return;
    }

    if (type === "solid") {
      const size = cellWidth * (0.48 + noise * 0.15);
      context.fillRect(originX + (cellWidth - size) * 0.5, originY + (cellHeight - size) * 0.5, size, size);
      return;
    }

    context.strokeRect(left, top, markWidth, markHeight);
  };

  const draw = (time) => {
    if (!width || !height) return;

    if (backgroundCanvas.width !== Math.ceil(width) || backgroundCanvas.height !== Math.ceil(height)) {
      drawBackground();
    }
    context.drawImage(backgroundCanvas, 0, 0, width, height);

    const rows = Math.round((settings.cells * 9) / 16);
    const cellWidth = width / settings.cells;
    const cellHeight = height / rows;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const phase = time;
    const bandSpacing = 0.158;
    const halfWidth = 0.059;

    for (let row = 0; row < rows; row += 1) {
      const y = ((row + 0.5) / rows - 0.5) * 0.9;

      for (let column = 0; column < settings.cells; column += 1) {
        const x = ((column + 0.5) / settings.cells - 0.5) * (16 / 9);
        const rotatedX = x * cosine - y * sine;
        const rotatedY = x * sine + y * cosine;
        const noise = makeNoise(column, row);
        let strongest = 0;
        let strongestBand = 0;

        for (let band = 0; band < settings.bands; band += 1) {
          const offset = (band - (settings.bands - 1) / 2) * bandSpacing;
          const broadWave = Math.sin(rotatedX * 4.4 + phase + band * 0.62)
            * settings.wave * settings.amount * 0.18;
          const fineWave = Math.sin(rotatedX * 11.2 - phase * 2 + band * 1.31)
            * 0.029 * settings.detail * settings.amount;
          const center = offset + broadWave + fineWave;
          const roughEdge = Math.sin(rotatedX * 19 + rotatedY * 27 + phase * 3 + band * 2)
            * 0.012 * settings.detail * settings.amount;
          const widthAtPoint = halfWidth + Math.sin(rotatedX * 3.8 + band + phase) * 0.008;
          const distance = Math.abs(rotatedY - center + roughEdge);
          const start = -0.79 + Math.sin(band * 1.7) * 0.055;
          const end = 0.79 + Math.cos(band * 1.4) * 0.075;
          const taper = Math.max(0, Math.min(1, (rotatedX - start) / 0.08, (end - rotatedX) / 0.08));
          const strength = Math.max(0, 1 - distance / widthAtPoint) * taper;

          if (strength > strongest) {
            strongest = strength;
            strongestBand = band;
          }
        }

        if (strongest > 0.08) {
          const texture = Math.sin(rotatedX * 5.2 + strongestBand * 1.72 + phase)
            + Math.sin(rotatedX * 10.8 - strongestBand * 1.15 - phase) * 0.56
            + Math.sin(rotatedY * 13 + rotatedX * 4 + phase * 2) * 0.22;
          const solidThreshold = 0.985 - strongest * 0.027;
          const markType = noise > solidThreshold ? "solid" : texture > 0.34 ? "diamond" : texture < -0.35 ? "cross" : "grid";
          drawMark(column, row, markType, noise, strongest);
        } else if (noise > 0.989) {
          drawMark(column, row, "solid", noise, 0.2);
        }
      }
    }

    context.globalAlpha = 1;
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);

    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawBackground();
    draw(phase);
  };

  const updateControl = () => {
    toggle.textContent = playing ? "Animation pausieren" : "Animation starten";
    toggle.setAttribute("aria-pressed", String(playing));

    if (status) {
      status.textContent = playing
        ? "Die Wellen bewegen sich. Mit P oder der Schaltfläche pausieren."
        : motionPreference.matches
          ? "Bewegung ist pausiert. Mit der Schaltfläche oder P bewusst starten."
          : "Animation pausiert. Mit P oder der Schaltfläche fortsetzen.";
    }
  };

  const animate = (time) => {
    frame = 0;

    if (!playing || !inView || document.hidden) return;

    if (!lastTick) lastTick = time;
    elapsed = (elapsed + Math.min(time - lastTick, frameInterval)) % loopDuration;
    lastTick = time;

    if (time - lastFrame >= frameInterval) {
      const loopFrame = Math.floor(elapsed / frameInterval);
      phase = (loopFrame / settings.loopFrames) * loopRadians;
      draw(phase);
      lastFrame = time;
    }

    frame = window.requestAnimationFrame(animate);
  };

  const syncAnimation = () => {
    if (playing && inView && !document.hidden && !frame) {
      lastFrame = 0;
      lastTick = 0;
      frame = window.requestAnimationFrame(animate);
    } else if ((!playing || !inView || document.hidden) && frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastTick = 0;
    }
  };

  const setPlaying = (next) => {
    playing = next;
    if (!playing) {
      draw(phase);
    }
    updateControl();
    syncAnimation();
  };

  toggle.addEventListener("click", () => setPlaying(!playing));

  if (copyButton) {
    const variation = "cells-93_bands-6_wave-45_tilt-m24_detail-100_amount-155_fps-12_loop-36";

    copyButton.addEventListener("click", async () => {
      let copied = false;

      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(variation);
          copied = true;
        }
      } catch {}

      if (!copied) {
        const field = document.createElement("textarea");
        field.value = variation;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.append(field);
        field.select();
        copied = document.execCommand("copy");
        field.remove();
      }

      if (!copied) {
        if (status) status.textContent = "Variation konnte nicht kopiert werden.";
        return;
      }

      copyButton.textContent = "Variation kopiert";
      if (status) status.textContent = `Variation kopiert: ${variation}`;
      window.setTimeout(() => {
        copyButton.textContent = "Variation kopieren";
      }, 1800);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "p" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, [contenteditable='true']")) return;

    event.preventDefault();
    setPlaying(!playing);
  });

  document.addEventListener("visibilitychange", syncAnimation);
  motionPreference.addEventListener("change", () => {
    if (motionPreference.matches) setPlaying(false);
    else updateControl();
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncAnimation();
    }).observe(canvas);
  }

  resize();
  updateControl();
  syncAnimation();
})();
