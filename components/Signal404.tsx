"use client";

import { useEffect, useRef } from "react";

const PALETTE = ["#0000ff", "#ffffff"] as const;

/**
 * Full-bleed 404 page: an electric-blue field of dithered glyphs that drifts
 * slowly behind an oversized difference-blended numeral. Everything is drawn
 * on a canvas, so the component has no asset or stylesheet dependencies.
 */
export default function Signal404() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const TAU = Math.PI * 2;

    const settings = {
      seed: 3827,
      cells: 88,
      bands: 6,
      field: "figure" as "figure" | "relief" | "slope",
      wave: 0.45,
      tilt: -0.69,
      detail: 0.63,
      size: 0.79,
      edges: 0.7,
      flecks: 0.03,
      smears: 0.26,
      dots: 0.45,
      palette: PALETTE,
      motion: { enabled: true, mode: "drift", amount: 0.6, fps: 12, frames: 36 },
    };

    const interval = 1000 / settings.motion.fps;
    const marks = settings.palette.length > 1 ? settings.palette.slice(1) : [settings.palette[0]];
    let width = 0;
    let height = 0;
    let frame = 30;
    let animationOrigin = 0;
    let animationRequest = 0;

    const hash = (x: number, y: number, seed: number) => {
      let value =
        Math.imul(x | 0, 374761393) +
        Math.imul(y | 0, 668265263) +
        Math.imul(seed | 0, 1274126177);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      value ^= value >>> 16;
      return (value >>> 0) / 4294967296;
    };

    const noise = (x: number, y: number, seed: number) => {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const dx = x - x0;
      const dy = y - y0;
      const sx = dx * dx * (3 - 2 * dx);
      const sy = dy * dy * (3 - 2 * dy);
      const a = hash(x0, y0, seed);
      const b = hash(x0 + 1, y0, seed);
      const c = hash(x0, y0 + 1, seed);
      const d = hash(x0 + 1, y0 + 1, seed);
      return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    };

    const random = (seed: number) => {
      let value = (seed >>> 0) || 1;
      return () => {
        value ^= value << 13;
        value >>>= 0;
        value ^= value >>> 17;
        value >>>= 0;
        value ^= value << 5;
        value >>>= 0;
        return value / 4294967296;
      };
    };

    const colorToRgb = (color: string): number[] => {
      const value = color.replace("#", "");
      return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) || 0);
    };

    const colorToCss = (rgb: number[]) =>
      `rgb(${rgb.map((channel) => Math.round(channel)).join(",")})`;

    const makeField = (phase: number) => {
      const { motion } = settings;
      const driftX =
        motion.enabled && motion.mode === "drift" ? Math.cos(phase) * motion.amount * 0.4 : 0;
      const driftY =
        motion.enabled && motion.mode === "drift" ? Math.sin(phase) * motion.amount * 0.4 : 0;
      const wave = settings.wave;
      const seedA = settings.seed * 7 + 1;
      const seedB = settings.seed * 7 + 2;
      const seedC = settings.seed * 7 + 3;
      const generator = random(
        (Math.imul(settings.seed, 2246822519) ^ 0x27d4eb2f) >>> 0,
      );
      const glyphs = ["square", "diamond", "ring", "x"];
      const bandGlyph: string[] = [];
      const bandInk: string[] = [];
      let previousGlyph = -1;
      let previousInk = -1;

      for (let band = 0; band < settings.bands; band += 1) {
        let glyphIndex = (generator() * glyphs.length) | 0;
        if (glyphIndex === previousGlyph) glyphIndex = (glyphIndex + 1) % glyphs.length;
        let inkIndex = (generator() * marks.length) | 0;
        if (inkIndex === previousInk) inkIndex = (inkIndex + 1) % marks.length;
        bandGlyph.push(glyphs[glyphIndex]);
        bandInk.push(marks[inkIndex]);
        previousGlyph = glyphIndex;
        previousInk = inkIndex;
      }

      const spine = 0.5 + (generator() - 0.5) * 0.2;
      const secondY = 0.55 + generator() * 0.3;
      const secondX = 0.3 + generator() * 0.4;
      const detailScale = 1 + settings.detail * 3;

      const scalar = (u: number, v: number) => {
        if (settings.field === "figure") {
          const widthAtV =
            0.16 +
            0.5 *
              wave *
              (0.3 +
                noise(v * detailScale * 1.6 + driftX + 3, 0.5 + driftY, seedA) +
                0.35 * noise(v * detailScale * 4 + driftY + 9, 1.5 + driftX, seedA));
          const centerAtV = spine + settings.tilt * (v - 0.5);
          const mainFigure = Math.abs(u - centerAtV) / widthAtV;
          const secondWidth =
            0.12 +
            0.36 *
              wave *
              (0.4 + noise(v * detailScale * 1.9 + driftX + 13, 2.5 + driftY, seedA));
          const secondFigure =
            Math.sqrt(
              ((u - secondX) / secondWidth) ** 2 +
                ((v - secondY) / (secondWidth * 1.6)) ** 2,
            ) * 0.9;
          return Math.min(1, mainFigure, secondFigure);
        }

        if (settings.field === "relief") {
          const value =
            0.65 *
              noise(
                u * detailScale * 1.3 + driftX + 5,
                (v + settings.tilt * u) * detailScale * 1.3 + driftY + 2,
                seedB,
              ) +
            0.35 *
              noise(
                u * detailScale * 3.1 + driftY + 8,
                (v + settings.tilt * u) * detailScale * 3.1 + driftX + 4,
                seedB,
              );
          return Math.min(1, Math.max(0, ((value - 0.2) / 0.6) * (0.6 + wave * 0.6)));
        }

        const slope =
          v +
          settings.tilt * (u - 0.5) +
          wave * 0.35 * (noise(u * detailScale * 1.5 + driftX + 7, 0.5 + driftY, seedC) - 0.5) * 2 +
          wave * 0.08 * (noise(u * detailScale * 6 + driftY + 3, 1.5 + driftX, seedC) - 0.5) * 2;
        return Math.min(1, Math.max(0, slope));
      };

      return { scalar, bandGlyph, bandInk };
    };

    const paint = (phase: number) => {
      if (!width || !height) return;

      const seed = settings.seed;
      const ground = settings.palette[0];
      const groundRgb = colorToRgb(ground);
      const dotColor = colorToCss(groundRgb.map((channel) => channel + (255 - channel) * 0.22));
      const { scalar, bandGlyph, bandInk } = makeField(phase);
      const columns = Math.max(8, settings.cells | 0);
      const cellSize = width / columns;
      const rows = Math.ceil(height / cellSize);
      const glyphSize = cellSize * settings.size;
      const bands = new Int8Array(columns * rows);

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          let band = Math.floor(
            scalar((column + 0.5) / columns, (row + 0.5) / rows) * settings.bands,
          );
          if (band >= settings.bands) band = settings.bands - 1;
          bands[row * columns + column] = band;
        }
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.fillStyle = ground;
      context.fillRect(0, 0, width, height);
      context.lineCap = "butt";
      context.lineJoin = "miter";

      const smearStart = new Int16Array(rows);
      const smearLength = new Int16Array(rows);
      smearStart.fill(-1);
      for (let row = 0; row < rows; row += 1) {
        if (hash(row, 1, seed) < settings.smears) {
          smearStart[row] = Math.floor(hash(row, 2, seed) * columns);
          smearLength[row] = 3 + Math.floor(hash(row, 3, seed) * Math.min(14, columns * 0.2));
        }
      }

      for (let row = 0; row < rows; row += 1) {
        const y = (row + 0.5) * cellSize;
        for (let column = 0; column < columns; column += 1) {
          const x = (column + 0.5) * cellSize;
          const band = bands[row * columns + column];
          const randomCell = hash(column, row, seed);

          if (band === settings.bands - 1) {
            if (settings.dots > 0 && randomCell > settings.flecks * 0.4) {
              context.fillStyle = dotColor;
              context.beginPath();
              context.arc(
                x,
                y,
                Math.max(0.3, cellSize * 0.09 * settings.dots),
                0,
                TAU,
              );
              context.fill();
            } else if (settings.flecks > 0 && randomCell <= settings.flecks * 0.4) {
              context.fillStyle = marks[(hash(column, row + 7, seed) * marks.length) | 0];
              context.fillRect(
                x - glyphSize * 0.3,
                y - glyphSize * 0.3,
                glyphSize * 0.6,
                glyphSize * 0.6,
              );
            }
            continue;
          }

          let ink = bandInk[band];
          let kind = bandGlyph[band];
          if (randomCell < settings.flecks) {
            ink = marks[(hash(column, row + 7, seed) * marks.length) | 0];
            kind = "square";
          } else {
            const right = column + 1 < columns ? bands[row * columns + column + 1] : band;
            const left = column > 0 ? bands[row * columns + column - 1] : band;
            const below = row + 1 < rows ? bands[(row + 1) * columns + column] : band;
            const above = row > 0 ? bands[(row - 1) * columns + column] : band;
            const edge = right !== band || left !== band || below !== band || above !== band;
            if (edge && hash(column, row + 3, seed) < settings.edges) {
              kind = "x";
              const currentInk = Math.max(0, marks.indexOf(ink));
              const offset =
                1 + ((hash(column, row + 11, seed) * (marks.length - 1)) | 0);
              ink = marks[(currentInk + offset) % marks.length];
            }
          }

          if (
            smearStart[row] >= 0 &&
            column >= smearStart[row] &&
            column < smearStart[row] + smearLength[row]
          ) {
            context.fillStyle = ink;
            context.fillRect(
              x - cellSize * 0.5,
              y - glyphSize * 0.32,
              cellSize + 0.5,
              glyphSize * 0.64,
            );
            continue;
          }

          context.fillStyle = ink;
          if (kind === "square") {
            context.fillRect(x - glyphSize * 0.5, y - glyphSize * 0.5, glyphSize, glyphSize);
          } else if (kind === "diamond") {
            const h = glyphSize * 0.55;
            context.beginPath();
            context.moveTo(x, y - h);
            context.lineTo(x + h * 0.78, y);
            context.lineTo(x, y + h);
            context.lineTo(x - h * 0.78, y);
            context.closePath();
            context.fill();
          } else if (kind === "ring") {
            context.fillRect(x - glyphSize * 0.5, y - glyphSize * 0.5, glyphSize, glyphSize);
            context.strokeStyle = ground;
            context.lineWidth = Math.max(0.6, glyphSize * 0.1);
            context.beginPath();
            context.arc(x, y, glyphSize * 0.3, 0, TAU);
            context.stroke();
            context.fillStyle = ground;
            context.beginPath();
            context.arc(x, y, glyphSize * 0.1, 0, TAU);
            context.fill();
          } else if (kind === "x") {
            context.strokeStyle = ink;
            context.lineWidth = Math.max(0.6, glyphSize * 0.16);
            const h = glyphSize * 0.36;
            context.beginPath();
            context.moveTo(x - h, y - h);
            context.lineTo(x + h, y + h);
            context.moveTo(x + h, y - h);
            context.lineTo(x - h, y + h);
            context.stroke();
          }
        }
      }
    };

    const draw = () => paint((frame / settings.motion.frames) * TAU);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(bounds.width * scale));
      height = Math.max(1, Math.round(bounds.height * scale));
      canvas.width = width;
      canvas.height = height;
      draw();
    };

    const animate = (time: number) => {
      const nextFrame =
        Math.floor((time - animationOrigin) / interval) % settings.motion.frames;
      if (nextFrame !== frame) {
        frame = nextFrame;
        draw();
      }
      animationRequest = window.requestAnimationFrame(animate);
    };

    let resizeObserver: ResizeObserver | undefined;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    resize();
    animationOrigin = performance.now() - frame * interval;
    animationRequest = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationRequest);
      animationRequest = 0;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      data-slot="signal-404"
      style={{
        position: "relative",
        width: "100%",
        height: "100dvh",
        minHeight: 420,
        overflow: "hidden",
        isolation: "isolate",
        background: PALETTE[0],
      }}
    >
      <style>{`
        @font-face {
          font-family: "Signal404 Display";
          font-style: normal;
          font-weight: 100 900;
          font-stretch: 75% 125%;
          font-display: block;
          src: url(data:font/woff2;base64,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) format("woff2");
        }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          background: PALETTE[0],
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>
      <h1
        aria-label="404 — Seite nicht gefunden"
        style={{
          position: "absolute",
          zIndex: 1,
          top: "50%",
          left: "50%",
          margin: 0,
          transform: "translate(-50%, -50%)",
          color: "#fff",
          fontFamily:
            '"Signal404 Display", "Archivo", "Arial Black", "Helvetica Neue", system-ui, sans-serif',
          fontSize: "min(500px, 54vw, 58vh)",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          lineHeight: 0.78,
          mixBlendMode: "difference",
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        404
      </h1>
    </div>
  );
}
