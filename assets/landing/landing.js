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

  /* Der Fortschritt folgt dem Scrollen nicht starr, sondern über eine kritisch
     gedämpfte Feder. Weil die Feder die Geschwindigkeit integriert, bleibt die
     Bewegung auch dann stetig, wenn das Mausrad in Rasten springt: keine
     Sprünge, kein Nachschwingen. Das Ziel wird in jedem Frame neu aus der
     aktuellen Scrollposition gelesen, damit Linie und Seite nie auseinander
     laufen. */
  const STIFFNESS = 150; // 1/s², ω ≈ 12,2 rad/s
  const DAMPING = 2 * Math.sqrt(STIFFNESS); // kritisch gedämpft

  let traceHeight = 1;
  let current = null;
  let velocity = 0;
  let frame = 0;
  let lastTime = 0;
  let ticking = false;
  let activeChapter = -2;

  const paintTrace = (progress) => {
    fill.style.transform = `scaleY(${progress})`;
    head.style.transform = `translateY(${progress * traceHeight}px) translateY(-50%)`;
  };

  const targetProgress = () => {
    const rect = trace.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const focus = viewport * 0.52;
    traceHeight = Math.max(rect.height, 1);
    return clamp((focus - rect.top) / traceHeight, 0, 1);
  };

  const animateTrace = (time) => {
    const dt = Math.min(Math.max((time - lastTime) / 1000, 0), 0.064) || 1 / 60;
    lastTime = time;

    const target = targetProgress();
    const accel = STIFFNESS * (target - current) - DAMPING * velocity;
    velocity += accel * dt;
    current += velocity * dt;

    if (Math.abs(target - current) < 0.00005 && Math.abs(velocity) < 0.0008) {
      current = target;
      velocity = 0;
      paintTrace(current);
      frame = 0;
      lastTime = 0;
      return;
    }

    paintTrace(current);
    frame = window.requestAnimationFrame(animateTrace);
  };

  const followTrace = () => {
    if (frame) return;
    if (!lastTime) lastTime = performance.now() - 16;
    frame = window.requestAnimationFrame(animateTrace);
  };

  const updateTrace = () => {
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const focus = viewport * 0.52;

    if (current === null) {
      current = targetProgress();
      velocity = 0;
      paintTrace(current);
    } else {
      followTrace();
    }

    let activeIndex = -1;
    for (let index = 0; index < chapters.length; index += 1) {
      if (chapters[index].getBoundingClientRect().top <= focus) activeIndex = index;
    }

    /* Nur bei einem Wechsel schreiben: sonst würde jedes Scroll-Frame das DOM
       und damit das Layout anfassen, was den Scrolling-Fluss ruckeln lässt. */
    if (activeIndex === activeChapter) return;
    activeChapter = activeIndex;

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

  /* Läuft ein Tab im Hintergrund, pausiert der Browser die Frames. Beim
     Zurückkommen steht die Linie dann sofort richtig, statt nachzulaufen. */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || current === null) return;
    current = targetProgress();
    velocity = 0;
    frame = 0;
    lastTime = 0;
    paintTrace(current);
  });

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
