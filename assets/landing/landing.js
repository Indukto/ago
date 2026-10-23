(() => {
  const trace = document.querySelector(".trace");
  const fill = document.querySelector(".trace__fill");
  const head = document.querySelector(".trace__head");
  const chapters = Array.from(document.querySelectorAll(".chapter"));
  const reveals = Array.from(document.querySelectorAll("[data-reveal]"));
  const meter = document.querySelector(".trace-meter");
  const meterIndex = document.getElementById("traceCurrent");
  const meterLabel = document.getElementById("traceLabel");

  if (!trace || !fill || !head) return;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  let ticking = false;

  const updateTrace = () => {
    const rect = trace.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const focus = viewport * 0.52;
    const progress = clamp((focus - rect.top) / Math.max(rect.height, 1), 0, 1);

    fill.style.transform = `scaleY(${progress})`;
    head.style.top = `${progress * 100}%`;

    let activeIndex = -1;
    for (let index = 0; index < chapters.length; index += 1) {
      if (chapters[index].getBoundingClientRect().top <= focus) activeIndex = index;
    }

    chapters.forEach((chapter, index) => {
      chapter.classList.toggle("is-active", index === activeIndex);
      chapter.classList.toggle("is-past", index < activeIndex);
    });

    if (meter && meterIndex && meterLabel) {
      if (activeIndex >= 0) {
        meter.classList.add("is-on");
        meterIndex.textContent = chapters[activeIndex].dataset.chapter || "";
        meterLabel.textContent = chapters[activeIndex].dataset.label || "";
      } else {
        meter.classList.remove("is-on");
      }
    }
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateTrace();
      ticking = false;
    });
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("load", requestUpdate);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    reveals.forEach((element) => observer.observe(element));
  } else {
    reveals.forEach((element) => element.classList.add("is-in"));
  }

  updateTrace();
  window.__landingReady = true;
})();
