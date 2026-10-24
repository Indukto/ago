(() => {
  const lens = document.querySelector(".cursor-lens");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (!lens || !finePointer.matches) return;

  const root = document.documentElement;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let lastFrame = 0;
  let animationFrame = 0;
  let visible = false;

  const paint = (x, y) => {
    lens.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  };

  const followPointer = (time) => {
    const elapsed = lastFrame ? Math.min(time - lastFrame, 48) : 16.67;
    lastFrame = time;

    // Exponential easing gives the same follow feel at every refresh rate.
    const easing = 1 - Math.exp(-elapsed / 46);
    currentX += (targetX - currentX) * easing;
    currentY += (targetY - currentY) * easing;

    const remaining = Math.hypot(targetX - currentX, targetY - currentY);
    if (remaining < 0.2) {
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
    visible = false;
    lastFrame = 0;
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
      root.classList.add("has-pointer-lens");
      visible = true;
      return;
    }

    if (!animationFrame) animationFrame = window.requestAnimationFrame(followPointer);
  }, { passive: true });

  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) hide();
  });
  window.addEventListener("blur", hide);
})();
