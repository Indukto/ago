(() => {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!finePointer.matches || reduceMotion.matches) return;

  /* A mouse wheel delivers one large delta per notch, and the browser jumps
     exactly that far in a single frame. That reads as stuttering next to a
     dragged scrollbar or a touch gesture. We keep the native scroll position,
     but ease toward a target that accumulates the wheel deltas. Scrollbar
     dragging, keyboard scrolling and reduced-motion stay native. */
  const FOLLOW_SECONDS = 0.065;
  const MAX_FRAME = 0.05;

  let current = window.scrollY;
  let target = current;
  let expected = null;
  let frame = 0;
  let lastTime = 0;
  let maxY = 0;

  /* Measure the height once instead of every frame: reading scrollHeight in
     rAF forces a layout before each write, which is exactly the stutter we
     are trying to remove. */
  const measureMax = () => {
    const scroller = document.scrollingElement || document.documentElement;
    maxY = Math.max(scroller.scrollHeight - window.innerHeight, 0);
  };

  const clampY = (value) => Math.min(Math.max(value, 0), maxY);

  const remeasure = () => {
    measureMax();
    target = clampY(target);
    current = clampY(current);
  };

  const write = (value) => {
    const y = clampY(value);
    expected = y;
    window.scrollTo({ top: y, behavior: "instant" });
  };

  const stop = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    current = window.scrollY;
    target = current;
  };

  const animate = (time) => {
    const elapsed = (time - lastTime) / 1000;
    const dt = elapsed > 0 ? Math.min(elapsed, MAX_FRAME) : 1 / 60;
    lastTime = time;

    current += (target - current) * (1 - Math.exp(-dt / FOLLOW_SECONDS));

    if (Math.abs(target - current) < 0.5) {
      current = target;
      write(current);
      frame = 0;
      lastTime = 0;
      return;
    }

    write(current);
    frame = window.requestAnimationFrame(animate);
  };

  const queue = (delta) => {
    if (!frame) {
      current = window.scrollY;
      target = current;
      lastTime = performance.now();
      frame = window.requestAnimationFrame(animate);
    }
    target = clampY(target + delta);
  };

  const onWheel = (event) => {
    if (!finePointer.matches || reduceMotion.matches) return;
    if (event.ctrlKey || event.shiftKey || event.defaultPrevented) return;

    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;
    else if (event.deltaMode === 2) delta *= window.innerHeight;
    if (!delta) return;

    event.preventDefault();
    queue(delta);
  };

  /* An external scroll (scrollbar, keyboard, anchor link) must win over the
     animation. Our own writes are ignored because expected tracks them. */
  const onScroll = () => {
    if (!frame) {
      target = window.scrollY;
      return;
    }
    if (expected !== null && Math.abs(window.scrollY - expected) <= 1) return;
    stop();
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onScroll, { passive: true });

  window.addEventListener("resize", remeasure, { passive: true });

  window.addEventListener("load", remeasure);

  if ("ResizeObserver" in window) {
    new ResizeObserver(remeasure).observe(document.body);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });

  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) stop();
  });

  remeasure();
})();
