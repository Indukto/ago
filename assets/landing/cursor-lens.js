(() => {
  const lens = document.querySelector(".cursor-lens");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!lens || !finePointer.matches) return;

  const INTERACTIVE = 'a.btn, button:not(:disabled), [role="button"]:not([aria-disabled="true"])';
  const REST_SCALE = 1;
  const HOVER_SCALE = 2;
  const root = document.documentElement;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let targetScale = REST_SCALE;
  let currentScale = REST_SCALE;
  let lastFrame = 0;
  let animationFrame = 0;
  let visible = false;

  const startAnimation = () => {
    if (!visible || animationFrame) return;
    lastFrame = 0;
    animationFrame = window.requestAnimationFrame(followPointer);
  };

  const setEnlarged = (enlarged) => {
    lens.classList.toggle("is-enlarged", enlarged);
    targetScale = enlarged ? HOVER_SCALE : REST_SCALE;
    startAnimation();
  };

  let hoverFrame = 0;
  const refreshHover = () => {
    if (!visible || hoverFrame) return;
    hoverFrame = window.requestAnimationFrame(() => {
      hoverFrame = 0;
      const element = document.elementFromPoint(targetX, targetY);
      setEnlarged(Boolean(element && element.closest(INTERACTIVE)));
    });
  };

  const paint = (x, y) => {
    lens.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    lens.style.setProperty("--lens-scale", currentScale.toFixed(4));
  };

  const followPointer = (time) => {
    const elapsed = lastFrame ? Math.min(time - lastFrame, 48) : 16.67;
    lastFrame = time;

    // Exponential easing gives the same follow feel at every refresh rate.
    const easing = 1 - Math.exp(-elapsed / 46);
    currentX += (targetX - currentX) * easing;
    currentY += (targetY - currentY) * easing;

    // The scale eases on the same clock, so growing and shrinking stay smooth
    // even where CSS transitions are disabled by reduced-motion settings.
    const scaleEasing = 1 - Math.exp(-elapsed / 70);
    currentScale += (targetScale - currentScale) * scaleEasing;
    if (Math.abs(targetScale - currentScale) < 0.001) currentScale = targetScale;

    const remaining = Math.hypot(targetX - currentX, targetY - currentY);
    if (remaining < 0.2 && currentScale === targetScale) {
      currentX = targetX;
      currentY = targetY;
      paint(currentX, currentY);
      animationFrame = 0;
      lastFrame = 0;
      return;
    }

    paint(currentX, currentY);
    animationFrame = window.requestAnimationFrame(followPointer);
  };

  const hide = () => {
    root.classList.remove("has-pointer-lens");
    lens.classList.remove("is-enlarged");
    targetScale = REST_SCALE;
    currentScale = REST_SCALE;
    lens.style.setProperty("--lens-scale", String(REST_SCALE));
    visible = false;
    lastFrame = 0;
    if (hoverFrame) {
      window.cancelAnimationFrame(hoverFrame);
      hoverFrame = 0;
    }
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  };

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;

    targetX = event.clientX;
    targetY = event.clientY;
    if (!visible) {
      currentX = targetX;
      currentY = targetY;
      paint(currentX, currentY);
      setEnlarged(Boolean(event.target.closest?.(INTERACTIVE)));
      root.classList.add("has-pointer-lens");
      visible = true;
      startAnimation();
      return;
    }

    if (!animationFrame) animationFrame = window.requestAnimationFrame(followPointer);
  }, { passive: true });

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    setEnlarged(Boolean(event.target.closest?.(INTERACTIVE)));
  }, { passive: true });

  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) {
      setEnlarged(false);
      return;
    }
    if (!event.relatedTarget.closest?.(INTERACTIVE)) setEnlarged(false);
  }, { passive: true });

  window.addEventListener("scroll", refreshHover, { passive: true });

  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) hide();
  });
  window.addEventListener("blur", hide);
})();
