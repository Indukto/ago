(() => {
  const trace = document.querySelector(".trace");
  const fill = document.querySelector(".trace__fill");
  const head = document.querySelector(".trace__head");
  const chapters = Array.from(document.querySelectorAll(".chapter"));
  const reveals = Array.from(document.querySelectorAll("[data-reveal]"));
  const antennaPaths = Array.from(document.querySelectorAll(".mast-antenna path"));
  const meter = document.querySelector(".trace-meter");
  const meterIndex = document.getElementById("traceCurrent");
  const meterLabel = document.getElementById("traceLabel");

  if (!trace || !fill || !head) return;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReduced = () => reduceQuery.matches;

  /* Der Fortschritt folgt dem Scrollen über eine kritisch gedämpfte Feder.
     Sie ist straff genug, dass die Linie am Scrollen klebt, glättet aber die
     Rasten des Mausrads. Die exakte Lösung bleibt auch bei niedrigen
     Bildraten stabil; das frühere Euler-Verfahren wurde bei hoher Steifigkeit
     instabil. */
  const STIFFNESS = 900; // 1/s², ω = 30 rad/s
  const OMEGA = Math.sqrt(STIFFNESS); // kritisch gedämpft

  /* Geometrie wird einmal gemessen statt in jedem Frame. getBoundingClientRect
     im Animationsframe erzwingt ein Layout, bevor der Browser zeichnen kann —
     bei einer 8000 px langen Seite der teuerste Teil der Schleife. */
  let traceTop = 0;
  let traceHeight = 1;
  let traceLocalHeight = 1;
  let chapterTops = [];
  let measured = false;

  let current = null;
  let velocity = 0;
  let frame = 0;
  let lastTime = 0;
  let ticking = false;
  let activeChapter = -2;

  const focusLine = () => (window.innerHeight || document.documentElement.clientHeight) * 0.52;

  const measure = () => {
    const rect = trace.getBoundingClientRect();
    traceTop = rect.top + window.scrollY;
    traceHeight = Math.max(rect.height, 1);
    /* clientHeight bleibt bei CSS-zoom in lokalen Pixeln. Der Kopf wird per
       transform bewegt; würde man die bereits gezoomte rect-Höhe einsetzen,
       liefe er um den Zoomfaktor zu weit. */
    traceLocalHeight = Math.max(trace.clientHeight, 1);
    chapterTops = chapters.map((chapter) => chapter.getBoundingClientRect().top + window.scrollY);
    measured = true;
  };

  const paintTrace = (progress) => {
    fill.style.transform = `scaleY(${progress})`;
    head.style.transform = `translateY(${progress * traceLocalHeight}px) translateY(-50%)`;
  };

  const targetProgress = () => {
    const topInViewport = traceTop - window.scrollY;
    return clamp((focusLine() - topInViewport) / traceHeight, 0, 1);
  };

  const animateTrace = (time) => {
    const dt = Math.min(Math.max((time - lastTime) / 1000, 0), 0.064) || 1 / 60;
    lastTime = time;

    const target = targetProgress();

    /* Exakte Lösung der kritisch gedämpften Feder. Sie ist unabhängig von der
       Bildrate stabil und schießt nicht über das Ziel hinaus. */
    const offset = current - target;
    const velocityTerm = velocity + OMEGA * offset;
    const decay = Math.exp(-OMEGA * dt);
    current = target + (offset + velocityTerm * dt) * decay;
    velocity = (velocityTerm - OMEGA * (offset + velocityTerm * dt)) * decay;

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

  const setTrace = (target) => {
    current = target;
    velocity = 0;
    paintTrace(current);
  };

  /* Der Wechsel im festen Kapitel-Readout war ein harter Textsprung mitten im
     Scrollen. Er läuft jetzt einmal kurz ein; bei reduzierter Bewegung steht der
     neue Wert sofort. */
  const swapReadout = (index, label) => {
    const changed = meterIndex.textContent !== index || meterLabel.textContent !== label;
    meterIndex.textContent = index;
    meterLabel.textContent = label;

    if (!changed || prefersReduced() || typeof meterIndex.animate !== "function") return;
    if (!meter.classList.contains("is-on")) return;

    const keyframes = [
      { opacity: 0, transform: "translateY(4px)" },
      { opacity: 1, transform: "translateY(0)" },
    ];
    const timing = { duration: 260, easing: "cubic-bezier(0.22, 0.68, 0.16, 1)" };
    meterIndex.animate(keyframes, timing);
    meterLabel.animate(keyframes, timing);
  };

  const update = () => {
    if (!measured) measure();

    const target = targetProgress();
    if (current === null) {
      setTrace(target);
    } else if (prefersReduced()) {
      /* Ohne Bewegungswunsch wird nicht gefedert, sondern gesetzt. */
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
      }
      if (Math.abs(target - current) > 0.0001) setTrace(target);
    } else {
      followTrace();
    }

    const focus = focusLine();
    const scroll = window.scrollY;
    let activeIndex = -1;
    for (let index = 0; index < chapterTops.length; index += 1) {
      if (chapterTops[index] - scroll <= focus) activeIndex = index;
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
        swapReadout(chapters[activeIndex].dataset.chapter || "", chapters[activeIndex].dataset.label || "");
      } else {
        meter.classList.remove("is-on");
      }
    }
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };

  const remeasure = () => {
    measured = false;
    requestUpdate();
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", remeasure);
  window.addEventListener("orientationchange", remeasure);
  window.addEventListener("load", remeasure);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasure).catch(() => {});
  }

  /* Die Höhe der Leitung hängt am Fließtext, nicht am Fenster: Nachgeladene
     Schriften oder ein anderes Umbruchverhalten ändern sie ohne Resize-Event.
     Der Observer meldet genau diese Änderung, danach wird neu gemessen. */
  if ("ResizeObserver" in window) {
    new ResizeObserver(remeasure).observe(trace);
  }

  reduceQuery.addEventListener("change", remeasure);

  /* Läuft ein Tab im Hintergrund, pausiert der Browser die Frames. Beim
     Zurückkommen steht die Linie dann sofort richtig, statt nachzulaufen. */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || current === null) return;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    measured = false;
    measure();
    setTrace(targetProgress());
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

  /* Die Antenne zeichnet sich einmal, Linie für Linie. Läuft nur beim ersten
     Laden, nie bei reduzierter Bewegung; ohne Animation bleibt die Skizze
     unverändert stehen. */
  const drawAntenna = () => {
    if (prefersReduced()) return;

    antennaPaths.forEach((path, index) => {
      if (typeof path.getTotalLength !== "function" || typeof path.animate !== "function") return;

      let length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        return;
      }
      if (!length) return;

      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;

      const animation = path.animate(
        [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        { duration: 820, delay: 420 + index * 55, easing: "cubic-bezier(0.22, 0.68, 0.16, 1)" },
      );

      const reset = () => {
        path.style.strokeDasharray = "";
        path.style.strokeDashoffset = "";
      };
      animation.finished.then(reset).catch(reset);
    });
  };

  if (document.readyState === "complete") {
    drawAntenna();
  } else {
    window.addEventListener("load", drawAntenna, { once: true });
  }

  update();
  window.__landingReady = true;
})();
