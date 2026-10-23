/* ==========================================================================
   Projektkalender — Funkstation & Smart City Lindau
   State, calendar math and interaction. No dependencies.
   ========================================================================== */

(() => {
  "use strict";

  const MONTHS = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];

  const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  const CATEGORIES = {
    sensor: { label: "LoRaWAN Sensoren", short: "Sensor" },
    funk: { label: "Funktechnik & Gateways", short: "Funk" },
    workshop: { label: "Messungen & Workshops", short: "Workshop" },
    milestone: { label: "Meilensteine & Freigaben", short: "Meilenstein" },
  };

  const SEED_EVENTS = [
    {
      id: "evt-01",
      date: "2026-03-03",
      time: "11:00",
      title: "Antennenbau Dipol",
      cat: "funk",
      desc: "Aufbau und Abgleich der Dipolantenne für den WebSDR-Empfang.",
    },
    {
      id: "evt-02",
      date: "2026-03-09",
      time: "09:00",
      title: "DARC e.V. Workshop",
      cat: "workshop",
      desc: "Workshop mit dem DARC e.V. zu Antennentechnik und Funkbetrieb.",
    },
    {
      id: "evt-03",
      date: "2026-03-11",
      time: "17:00",
      title: "Meilenstein: Dachaufbau",
      cat: "milestone",
      desc: "Freigabe des Dachaufbaus und Dokumentation der Montagepunkte.",
    },
    {
      id: "evt-04",
      date: "2026-03-12",
      time: "14:30",
      title: "MeshCore Test BOGY",
      cat: "funk",
      desc: "Reichweitentest des MeshCore-Knotens auf dem Schulgelände.",
    },
    {
      id: "evt-05",
      date: "2026-03-12",
      time: "16:00",
      title: "Datenpipeline TTN-Check",
      cat: "sensor",
      desc: "End-to-End-Prüfung der Datenkette vom Sensor bis zum Dashboard.",
    },
    {
      id: "evt-06",
      date: "2026-03-17",
      time: "15:00",
      title: "MQTT Broker Routing",
      cat: "sensor",
      desc: "Routing-Regeln und Topics für die Sensordaten prüfen.",
    },
    {
      id: "evt-07",
      date: "2026-03-20",
      time: "08:00",
      title: "Physik-Kolloquium",
      cat: "workshop",
      desc: "Vortrag und Diskussion im Rahmen des P-Seminars Physik.",
    },
    {
      id: "evt-08",
      date: "2026-03-25",
      time: "10:00",
      title: "BNetzA Standortmeldung",
      cat: "milestone",
      desc: "Standortmeldung bei der Bundesnetzagentur vorbereiten und einreichen.",
    },
    {
      id: "evt-09",
      date: "2026-03-30",
      time: "13:00",
      title: "Grafana Dashboard Review",
      cat: "sensor",
      desc: "Review der Dashboards und Visualisierungen für die Messdaten.",
    },
    {
      id: "evt-10",
      date: "2026-03-31",
      time: "17:00",
      title: "P-Seminar Zwischenbericht",
      cat: "milestone",
      desc: "Zwischenstand dokumentieren und nächste Meilensteine festlegen.",
    },
  ];

  const initialToday = new Date();
  const initialKey = [
    initialToday.getFullYear(),
    String(initialToday.getMonth() + 1).padStart(2, "0"),
    String(initialToday.getDate()).padStart(2, "0"),
  ].join("-");

  const state = {
    view: new Date(initialToday.getFullYear(), initialToday.getMonth(), 1),
    selected: initialKey,
    filters: new Set(Object.keys(CATEGORIES)),
    events: SEED_EVENTS.map((event) => ({ ...event })),
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const grid = $("#calendarGrid");
  const agenda = $("#agenda");
  const legend = $("#legend");
  const focusDay = $("#focusDay");
  const focusMonth = $("#focusMonth");
  const focusMeta = $("#focusMeta");
  const focusEvents = $("#focusEvents");
  const upcoming = $("#upcoming");
  const upcomingCount = $("#upcomingCount");
  const heroMonth = $("#heroMonth");
  const heroYear = $("#heroYear");
  const heroGhost = $("#heroGhost");
  const heroStats = $("#heroStats");
  const heroCats = $("#heroCats");
  const heroWeeks = $("#heroWeeks");
  const panelCode = $("#panelCode");
  const docCode = $("#docCode");
  const panelStats = $("#panelStats");
  const calendarTitle = $("#calendar-title");
  const statEvents = $("#statEvents");
  const statMilestones = $("#statMilestones");
  const statCategories = $("#statCategories");
  const dialog = $("#eventDialog");
  const eventForm = $("#eventForm");

  const pad = (value) => String(value).padStart(2, "0");
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseKey = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  };
  const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  };
  const isSameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  function isoWeek(date) {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function eventsFor(key, includeFiltered = false) {
    return state.events
      .filter((event) => event.date === key)
      .filter((event) => includeFiltered || state.filters.has(event.cat))
      .sort((a, b) => a.time.localeCompare(b.time, "de"));
  }

  function visibleMonthEvents() {
    return state.events
      .filter((event) => {
        const date = parseKey(event.date);
        return isSameMonth(date, state.view) && state.filters.has(event.cat);
      })
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`, "de"));
  }

  function selectDate(key, { focus = false, navigate = false } = {}) {
    const next = parseKey(key);
    state.selected = key;
    if (navigate && !isSameMonth(next, state.view)) {
      state.view = new Date(next.getFullYear(), next.getMonth(), 1);
    }
    renderAll();
    if (focus) {
      requestAnimationFrame(() => {
        const cell = grid.querySelector(`.day[data-date="${key}"]`);
        cell?.focus({ preventScroll: true });
      });
    }
  }

  function goMonth(offset) {
    const selected = parseKey(state.selected);
    const target = new Date(state.view.getFullYear(), state.view.getMonth() + offset, 1);
    const targetDay = Math.min(selected.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
    state.view = target;
    state.selected = dateKey(new Date(target.getFullYear(), target.getMonth(), targetDay));
    renderAll();
  }

  function renderCalendar() {
    const year = state.view.getFullYear();
    const month = state.view.getMonth();
    const first = new Date(year, month, 1);
    const leading = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -leading);
    const todayKey = dateKey(new Date());

    const head = `
      <div class="week-row week-row--head" role="row">
        <div class="weekday weekday--kw" role="columnheader">KW</div>
        ${WEEKDAYS_SHORT.slice(1)
          .concat(WEEKDAYS_SHORT.slice(0, 1))
          .map(
            (day) =>
              `<div class="weekday${day === "Sa" || day === "So" ? " weekday--weekend" : ""}" role="columnheader" aria-label="${WEEKDAYS[WEEKDAYS_SHORT.indexOf(day)]}">${day}</div>`,
          )
          .join("")}
      </div>`;

    let rows = "";
    for (let week = 0; week < 6; week += 1) {
      const weekStart = addDays(gridStart, week * 7);
      let cells = "";
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const date = addDays(weekStart, dayIndex);
        const key = dateKey(date);
        const outside = !isSameMonth(date, state.view);
        const weekend = date.getDay() === 0 || date.getDay() === 6;
        const selected = key === state.selected;
        const today = key === todayKey;
        const events = eventsFor(key);
        const allEvents = eventsFor(key, true);
        const count = allEvents.length;
        const label = `${WEEKDAYS[date.getDay()]}, ${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}${
          count ? `, ${count} ${count === 1 ? "Termin" : "Termine"}` : ", keine Termine"
        }`;

        const classes = [
          "day",
          outside ? "is-outside" : "",
          weekend ? "is-weekend" : "",
          selected ? "is-selected" : "",
          today ? "is-today" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const visibleEvents = events.slice(0, 2);
        const hiddenCount = events.length - visibleEvents.length;

        cells += `
          <div
            class="${classes}"
            role="gridcell"
            data-date="${key}"
            tabindex="${selected ? "0" : "-1"}"
            aria-selected="${selected}"
            ${today ? 'aria-current="date"' : ""}
            aria-label="${escapeHTML(label)}"
          >
            <div class="day-top">
              <span class="day-num">${date.getDate()}</span>
              <span class="day-code">${outside ? MONTHS_SHORT[date.getMonth()].toUpperCase() : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`}</span>
            </div>
            <div class="day-events">
              ${visibleEvents
                .map(
                  (event) => `
                    <button
                      type="button"
                      class="event event--${event.cat}"
                      data-event-id="${escapeHTML(event.id)}"
                      title="${escapeHTML(`${event.time} · ${event.title}`)}"
                      aria-label="${escapeHTML(`${event.time} ${event.title}`)}"
                    >
                      <span class="event-time">${escapeHTML(event.time)}</span>
                      <span class="event-title">${escapeHTML(event.title)}</span>
                    </button>`,
                )
                .join("")}
              ${hiddenCount > 0 ? `<span class="event-more">+${hiddenCount} weitere</span>` : ""}
            </div>
          </div>`;
      }

      rows += `
        <div class="week-row" role="row">
          <div class="weeknum" role="rowheader" aria-label="Kalenderwoche ${isoWeek(weekStart)}">
            <span>KW</span><span>${pad(isoWeek(weekStart))}</span>
          </div>
          ${cells}
        </div>`;
    }

    grid.setAttribute("aria-rowcount", "7");
    grid.setAttribute("aria-colcount", "8");
    grid.innerHTML = head + rows;
  }

  function renderHero() {
    const month = state.view.getMonth();
    const year = state.view.getFullYear();
    const events = visibleMonthEvents();
    const categories = new Set(events.map((event) => event.cat));
    const first = new Date(year, month, 1);
    const leading = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -leading);
    const gridEnd = addDays(gridStart, 41);

    heroMonth.textContent = MONTHS[month];
    heroYear.textContent = String(year);
    heroGhost.textContent = pad(month + 1);
    heroStats.textContent = `${events.length} ${events.length === 1 ? "Termin" : "Termine"}`;
    heroCats.textContent = `${categories.size} ${categories.size === 1 ? "Kategorie" : "Kategorien"}`;
    heroWeeks.textContent = `KW ${pad(isoWeek(gridStart))}—${pad(isoWeek(gridEnd))}`;
    panelCode.textContent = `${pad(month + 1)}—${year}`;
    docCode.textContent = `KAL / ${year} / ${pad(month + 1)}`;
    panelStats.textContent = `${events.length} ${events.length === 1 ? "Termin" : "Termine"} · ${daysInMonth(year, month)} Tage`;
    calendarTitle.textContent = `${MONTHS[month]} ${year}`;
    document.title = `Projektkalender — ${MONTHS[month]} ${year} | Funkstation & Smart City Lindau`;

    statEvents.textContent = pad(events.length);
    statMilestones.textContent = pad(events.filter((event) => event.cat === "milestone").length);
    statCategories.textContent = pad(categories.size);
  }

  function renderFocus() {
    const selected = parseKey(state.selected);
    const events = eventsFor(state.selected);
    focusDay.textContent = pad(selected.getDate());
    focusMonth.innerHTML = `${escapeHTML(MONTHS[selected.getMonth()])}<br />${selected.getFullYear()}`;
    focusMeta.textContent = `${WEEKDAYS[selected.getDay()]} · KW ${pad(isoWeek(selected))}`;

    if (!events.length) {
      focusEvents.innerHTML = '<p class="focus-empty">Keine Termine an diesem Tag</p>';
      return;
    }

    focusEvents.innerHTML = events
      .map(
        (event) => `
          <article class="focus-event">
            <time datetime="${escapeHTML(`${event.date}T${event.time}`)}">${escapeHTML(event.time)}</time>
            <div>
              <h3>${escapeHTML(event.title)}</h3>
              ${event.desc ? `<p>${escapeHTML(event.desc)}</p>` : ""}
            </div>
          </article>`,
      )
      .join("");
  }

  function renderUpcoming() {
    const selected = parseKey(state.selected);
    const items = visibleMonthEvents()
      .filter((event) => event.date > state.selected && isSameMonth(parseKey(event.date), selected))
      .slice(0, 4);

    upcomingCount.textContent = pad(items.length);

    if (!items.length) {
      upcoming.innerHTML = '<li class="upcoming-empty">Keine weiteren Termine</li>';
      return;
    }

    upcoming.innerHTML = items
      .map((event) => {
        const date = parseKey(event.date);
        return `
          <li>
            <button type="button" data-date="${event.date}" aria-label="${escapeHTML(`${WEEKDAYS[date.getDay()]}, ${date.getDate()}. ${MONTHS[date.getMonth()]}: ${event.title}`)}">
              <time datetime="${event.date}">${pad(date.getDate())}.${pad(date.getMonth() + 1)}</time>
              <span>
                <span class="up-title">${escapeHTML(event.title)}</span>
                <span class="up-cat">${escapeHTML(CATEGORIES[event.cat].short)}</span>
              </span>
              <span class="up-dot" data-cat="${event.cat}" aria-hidden="true"></span>
            </button>
          </li>`;
      })
      .join("");
  }

  function renderAgenda() {
    const events = visibleMonthEvents();
    if (!events.length) {
      agenda.innerHTML = '<p class="agenda-empty">Keine Termine im gewählten Filter.</p>';
      return;
    }

    const grouped = new Map();
    events.forEach((event) => {
      if (!grouped.has(event.date)) grouped.set(event.date, []);
      grouped.get(event.date).push(event);
    });

    agenda.innerHTML = Array.from(grouped.entries())
      .map(([key, dayEvents]) => {
        const date = parseKey(key);
        return `
          <article class="agenda-day">
            <div class="agenda-date">
              <strong>${pad(date.getDate())}</strong>
              <span>${escapeHTML(MONTHS_SHORT[date.getMonth()])}<br />${WEEKDAYS_SHORT[date.getDay()]}</span>
            </div>
            <div class="agenda-list">
              ${dayEvents
                .map(
                  (event) => `
                    <div class="agenda-event event--${event.cat}">
                      <time datetime="${escapeHTML(`${event.date}T${event.time}`)}">${escapeHTML(event.time)}</time>
                      <div>
                        <h3>${escapeHTML(event.title)}</h3>
                        ${event.desc ? `<p>${escapeHTML(event.desc)}</p>` : ""}
                      </div>
                    </div>`,
                )
                .join("")}
            </div>
          </article>`;
      })
      .join("");
  }

  function renderFilters() {
    $$(".legend-btn", legend).forEach((button) => {
      const active = state.filters.has(button.dataset.cat);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderAll() {
    renderHero();
    renderCalendar();
    renderFocus();
    renderUpcoming();
    renderAgenda();
    renderFilters();
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */

  grid.addEventListener("click", (event) => {
    const eventChip = event.target.closest(".event");
    if (eventChip) {
      const cell = eventChip.closest(".day");
      if (cell) selectDate(cell.dataset.date);
      return;
    }

    const cell = event.target.closest(".day");
    if (!cell) return;
    selectDate(cell.dataset.date, { navigate: cell.classList.contains("is-outside") });
  });

  grid.addEventListener("keydown", (event) => {
    if (event.target.closest(".event")) return;
    const cell = event.target.closest(".day");
    if (!cell) return;

    const current = parseKey(cell.dataset.date);
    let delta = null;

    if (event.key === "ArrowLeft") delta = -1;
    if (event.key === "ArrowRight") delta = 1;
    if (event.key === "ArrowUp") delta = -7;
    if (event.key === "ArrowDown") delta = 7;
    if (event.key === "Home") delta = -((current.getDay() + 6) % 7);
    if (event.key === "End") delta = 6 - ((current.getDay() + 6) % 7);

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDate(cell.dataset.date, { focus: true, navigate: cell.classList.contains("is-outside") });
      return;
    }

    if (delta === null) return;
    event.preventDefault();
    const next = addDays(current, delta);
    selectDate(dateKey(next), {
      focus: true,
      navigate: !isSameMonth(next, state.view),
    });
  });

  upcoming.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    selectDate(button.dataset.date);
  });

  legend.addEventListener("click", (event) => {
    const button = event.target.closest(".legend-btn");
    if (!button) return;
    const category = button.dataset.cat;
    if (state.filters.has(category)) {
      state.filters.delete(category);
    } else {
      state.filters.add(category);
    }
    renderAll();
  });

  $("#resetFilters").addEventListener("click", () => {
    state.filters = new Set(Object.keys(CATEGORIES));
    renderAll();
  });

  $("#prevMonth").addEventListener("click", () => goMonth(-1));
  $("#nextMonth").addEventListener("click", () => goMonth(1));

  $("#todayBtn").addEventListener("click", () => {
    const today = new Date();
    state.view = new Date(today.getFullYear(), today.getMonth(), 1);
    state.selected = dateKey(today);
    renderAll();
  });

  /* ------------------------------------------------------------------------
     Add-event dialog
     ------------------------------------------------------------------------ */

  const openDialog = () => {
    const selected = parseKey(state.selected);
    $("#eventDate").value = state.selected;
    $("#eventTime").value = "12:00";
    $("#eventTitle").value = "";
    $("#eventNote").value = "";
    $("#eventCategory").value = "workshop";
    dialog.showModal();
    requestAnimationFrame(() => $("#eventTitle").focus());
    void selected;
  };

  $("#addEvent").addEventListener("click", openDialog);
  $("#dialogClose").addEventListener("click", () => dialog.close());
  $("#dialogCancel").addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(eventForm);
    const date = String(form.get("date") || "");
    const time = String(form.get("time") || "");
    const title = String(form.get("title") || "").trim();
    const category = String(form.get("category") || "workshop");
    const note = String(form.get("note") || "").trim();

    if (!date || !time || !title) return;
    if (!CATEGORIES[category]) return;

    state.events.push({
      id: `evt-${Date.now()}`,
      date,
      time,
      title,
      cat: category,
      desc: note,
    });

    const saved = parseKey(date);
    state.view = new Date(saved.getFullYear(), saved.getMonth(), 1);
    state.selected = date;
    dialog.close();
    eventForm.reset();
    $("#eventTime").value = "12:00";
    renderAll();
  });

  renderAll();
})();
