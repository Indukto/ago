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

  const STORAGE_KEY = "funkstation.kalender.v1";
  const STORAGE_VERSION = 1;
  const MAX_EVENTS = 500;
  const MIGRATION_KEY = "funkstation.kalender.global-migrated.v1";
  const API_URL = String(window.KALENDER_API_URL || "/api/events").replace(/\/+$/, "");
  const SYNC_INTERVAL = 15000;
  const NOTE_LOCAL = "Globaler Speicher nicht erreichbar — Termine werden nur in diesem Browser gespeichert.";
  const NOTE_BLOCKED = "Speicher nicht verfügbar — Termine bleiben nur bis zum Neuladen erhalten.";

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
    events: [],
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
  const statDone = $("#statDone");
  const dialog = $("#eventDialog");
  const eventForm = $("#eventForm");
  const storageNote = $("#storageNote");
  const confirmDialog = $("#confirmDialog");
  const confirmText = $("#confirmText");

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

  /* ------------------------------------------------------------------------
     Storage
     ------------------------------------------------------------------------ */

  const storageAvailable = (() => {
    try {
      const probe = `${STORAGE_KEY}.probe`;
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  })();

  let storageMode = "local";
  let globalReady = false;
  let pendingWrites = 0;
  let syncTimer = 0;

  function setStorageMode(mode) {
    storageMode = mode;
    if (!storageNote) return;

    if (mode === "global") {
      storageNote.hidden = true;
      return;
    }

    storageNote.textContent = storageAvailable ? NOTE_LOCAL : NOTE_BLOCKED;
    storageNote.hidden = false;
  }

  function useLocalFallback() {
    globalReady = false;
    window.clearTimeout(syncTimer);
    setStorageMode("local");
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `evt-${window.crypto.randomUUID()}`;
    }
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

  function sanitizeEvent(raw) {
    if (!raw || typeof raw !== "object") return null;

    const date = String(raw.date || "");
    const time = String(raw.time || "");
    const title = String(raw.title || "").trim().slice(0, 64);
    const cat = String(raw.cat || "");
    if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time) || !title || !CATEGORIES[cat]) return null;

    const parsedDate = parseKey(date);
    if (Number.isNaN(parsedDate.getTime()) || dateKey(parsedDate) !== date) return null;

    return {
      id: String(raw.id || "").trim().slice(0, 96) || makeId(),
      date,
      time,
      title,
      cat,
      desc: String(raw.desc || "").trim().slice(0, 220),
      done: raw.done === true,
    };
  }

  function normalizeEventList(list) {
    const seen = new Set();

    return (Array.isArray(list) ? list : [])
      .slice(0, MAX_EVENTS)
      .map(sanitizeEvent)
      .filter((event) => {
        if (!event || seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      });
  }

  function loadLocalEvents() {
    if (!storageAvailable) return [];

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return normalizeEventList(Array.isArray(parsed) ? parsed : parsed && parsed.events);
    } catch {
      return [];
    }
  }

  function saveLocalEvents({ silent = false } = {}) {
    if (!storageAvailable) {
      if (!silent) setStorageMode("local");
      return false;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, events: state.events }),
      );
      return true;
    } catch {
      if (!silent) setStorageMode("local");
      return false;
    }
  }

  async function requestJSON(path, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body) headers["Content-Type"] = "application/json";

    try {
      const response = await fetch(path, {
        ...options,
        headers,
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      if (response.status === 204) return null;
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function migrateLocalEvents(serverEvents) {
    if (!storageAvailable || window.localStorage.getItem(MIGRATION_KEY) === "1") return serverEvents;

    const localEvents = loadLocalEvents();
    const serverIds = new Set(serverEvents.map((event) => event.id));
    const pending = localEvents.filter((event) => !serverIds.has(event.id));
    if (!pending.length) {
      window.localStorage.setItem(MIGRATION_KEY, "1");
      return serverEvents;
    }

    const merged = [...serverEvents];
    for (const event of pending) {
      try {
        const payload = await requestJSON(API_URL, {
          method: "POST",
          body: JSON.stringify(event),
        });
        const saved = sanitizeEvent(payload && payload.event ? payload.event : payload);
        if (saved) merged.push(saved);
      } catch (error) {
        if (error.status !== 409) throw error;
      }
    }

    window.localStorage.setItem(MIGRATION_KEY, "1");
    return merged;
  }

  function scheduleGlobalSync() {
    window.clearTimeout(syncTimer);
    if (!globalReady || document.hidden) return;
    syncTimer = window.setTimeout(() => {
      void syncGlobal();
    }, SYNC_INTERVAL);
  }

  async function syncGlobal({ initial = false } = {}) {
    if (!initial && (!globalReady || document.hidden || pendingWrites > 0)) {
      if (globalReady) scheduleGlobalSync();
      return;
    }

    try {
      const payload = await requestJSON(API_URL);
      const list = payload && Array.isArray(payload.events) ? payload.events : Array.isArray(payload) ? payload : null;
      if (!list) throw new Error("Ungültige Antwort");

      const events = initial
        ? await migrateLocalEvents(normalizeEventList(list))
        : normalizeEventList(list);
      const changed = JSON.stringify(events) !== JSON.stringify(state.events);
      state.events = events;
      globalReady = true;
      setStorageMode("global");
      saveLocalEvents({ silent: true });
      if (changed) renderAll();
    } catch {
      if (initial) {
        globalReady = false;
        setStorageMode("local");
      }
    } finally {
      if (globalReady) scheduleGlobalSync();
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearTimeout(syncTimer);
    } else if (globalReady) {
      void syncGlobal();
    }
  });

  window.addEventListener("focus", () => {
    if (globalReady && !document.hidden) void syncGlobal();
  });

  state.events = loadLocalEvents();

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
                      class="event event--${event.cat}${event.done ? " is-done" : ""}"
                      data-event-id="${escapeHTML(event.id)}"
                      title="${escapeHTML(`${event.time} · ${event.title}${event.done ? " · erledigt" : ""}`)}"
                      aria-label="${escapeHTML(`${event.time} ${event.title}${event.done ? ", erledigt" : ""}`)}"
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
    statDone.textContent = pad(events.filter((event) => event.done).length);
  }

  function eventActions(event) {
    const label = escapeHTML(event.title);
    const id = escapeHTML(event.id);

    return `
      <div class="event-actions">
        <button
          type="button"
          class="event-action"
          data-action="toggle"
          data-event-id="${id}"
          aria-pressed="${event.done}"
          aria-label="${label} ${event.done ? "als offen markieren" : "als erledigt markieren"}"
          title="${event.done ? "Als offen markieren" : "Als erledigt markieren"}"
        >${event.done ? "✓" : "○"}</button>
        <button
          type="button"
          class="event-action"
          data-action="delete"
          data-event-id="${id}"
          aria-label="${label} löschen"
          title="Termin löschen"
        >×</button>
      </div>`;
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
          <article class="focus-event${event.done ? " is-done" : ""}">
            <time datetime="${escapeHTML(`${event.date}T${event.time}`)}">${escapeHTML(event.time)}</time>
            <div>
              <h3>${escapeHTML(event.title)}</h3>
              ${event.desc ? `<p>${escapeHTML(event.desc)}</p>` : ""}
              ${eventActions(event)}
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
      agenda.innerHTML =
        '<p class="agenda-empty">Keine Termine im gewählten Filter. Mit „+ Termin“ einen Eintrag anlegen.</p>';
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
                    <div class="agenda-event event--${event.cat}${event.done ? " is-done" : ""}">
                      <time datetime="${escapeHTML(`${event.date}T${event.time}`)}">${escapeHTML(event.time)}</time>
                      <div>
                        <h3>${escapeHTML(event.title)}</h3>
                        ${event.desc ? `<p>${escapeHTML(event.desc)}</p>` : ""}
                        ${eventActions(event)}
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
     Completion, deletion and storage sync
     ------------------------------------------------------------------------ */

  function findEvent(id) {
    return state.events.find((event) => event.id === id);
  }

  function formatLongDate(key) {
    const date = parseKey(key);
    return `${WEEKDAYS[date.getDay()]}, ${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  let pendingDeleteId = null;

  function askDelete(id) {
    const event = findEvent(id);
    if (!event) return;

    pendingDeleteId = id;
    confirmText.textContent = `${event.title} — ${formatLongDate(event.date)}, ${event.time}. Dieser Eintrag wird dauerhaft gelöscht.`;
    if (!confirmDialog.open) confirmDialog.showModal();
  }

  function restoreActionFocus(id, action) {
    const selector = `[data-action="${action}"][data-event-id="${CSS.escape(id)}"]`;
    const button = Array.from(document.querySelectorAll(selector)).find(
      (candidate) => candidate.getClientRects().length > 0,
    );
    button?.focus({ preventScroll: true });
  }

  async function toggleDone(id) {
    const event = findEvent(id);
    if (!event) return;

    const nextDone = !event.done;
    event.done = nextDone;
    renderAll();
    restoreActionFocus(id, "toggle");

    if (storageMode !== "global") {
      saveLocalEvents();
      return;
    }

    pendingWrites += 1;
    try {
      const payload = await requestJSON(`${API_URL}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ done: nextDone }),
      });
      const saved = sanitizeEvent(payload && payload.event ? payload.event : payload);
      if (saved) {
        const current = findEvent(id);
        if (current) Object.assign(current, saved);
        saveLocalEvents({ silent: true });
      }
    } catch (error) {
      if (error.status === 404) {
        state.events = state.events.filter((item) => item.id !== id);
        saveLocalEvents({ silent: true });
      } else {
        const current = findEvent(id);
        if (current) current.done = !nextDone;
        useLocalFallback();
        saveLocalEvents();
      }
      renderAll();
      restoreActionFocus(id, "toggle");
    } finally {
      pendingWrites -= 1;
    }
  }

  async function persistCreatedEvent(event) {
    if (storageMode !== "global") return;

    pendingWrites += 1;
    try {
      const payload = await requestJSON(API_URL, {
        method: "POST",
        body: JSON.stringify(event),
      });
      const saved = sanitizeEvent(payload && payload.event ? payload.event : payload);
      if (saved) {
        const index = state.events.findIndex((item) => item.id === event.id);
        if (index >= 0) state.events[index] = saved;
        saveLocalEvents({ silent: true });
      }
    } catch {
      useLocalFallback();
      saveLocalEvents();
    } finally {
      pendingWrites -= 1;
    }
  }

  async function deleteEvent(id) {
    const index = state.events.findIndex((event) => event.id === id);
    if (index < 0) {
      confirmDialog.close();
      return;
    }

    const [removed] = state.events.splice(index, 1);
    confirmDialog.close();
    renderAll();
    const cell = grid.querySelector(".day.is-selected") || grid.querySelector(".day");
    cell?.focus({ preventScroll: true });

    if (storageMode !== "global") {
      saveLocalEvents();
      return;
    }

    pendingWrites += 1;
    try {
      await requestJSON(`${API_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
      saveLocalEvents({ silent: true });
    } catch (error) {
      if (error.status !== 404) {
        state.events.splice(index, 0, removed);
        renderAll();
        useLocalFallback();
        saveLocalEvents();
      } else {
        saveLocalEvents({ silent: true });
      }
    } finally {
      pendingWrites -= 1;
    }
  }

  function handleEventAction(click) {
    const button = click.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.eventId;
    const event = findEvent(id);
    if (!event) return;

    if (button.dataset.action === "toggle") {
      void toggleDone(id);
      return;
    }

    if (button.dataset.action === "delete") askDelete(id);
  }

  focusEvents.addEventListener("click", handleEventAction);
  agenda.addEventListener("click", handleEventAction);

  $("#confirmCancel").addEventListener("click", () => confirmDialog.close());
  $("#confirmClose").addEventListener("click", () => confirmDialog.close());
  confirmDialog.addEventListener("click", (event) => {
    if (event.target === confirmDialog) confirmDialog.close();
  });
  confirmDialog.addEventListener("close", () => {
    pendingDeleteId = null;
  });

  $("#confirmDelete").addEventListener("click", () => {
    if (!pendingDeleteId) return;

    const id = pendingDeleteId;
    pendingDeleteId = null;
    void deleteEvent(id);
  });

  window.addEventListener("storage", (event) => {
    if (storageMode === "global") return;
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    state.events = loadLocalEvents();
    renderAll();
  });

  /* ------------------------------------------------------------------------
     Add-event dialog
     ------------------------------------------------------------------------ */

  const openDialog = () => {
    $("#eventDate").value = state.selected;
    $("#eventTime").value = "12:00";
    $("#eventTitle").value = "";
    $("#eventNote").value = "";
    $("#eventCategory").value = "workshop";
    dialog.showModal();
    requestAnimationFrame(() => $("#eventTitle").focus());
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

    const newEvent = sanitizeEvent({
      id: makeId(),
      date,
      time,
      title,
      cat: category,
      desc: note,
      done: false,
    });
    if (!newEvent) return;

    state.events.push(newEvent);
    saveLocalEvents({ silent: storageMode === "global" });

    const saved = parseKey(newEvent.date);
    state.view = new Date(saved.getFullYear(), saved.getMonth(), 1);
    state.selected = newEvent.date;
    dialog.close();
    eventForm.reset();
    $("#eventTime").value = "12:00";
    renderAll();

    if (storageMode === "global") void persistCreatedEvent(newEvent);
  });

  renderAll();
  void syncGlobal({ initial: true });
})();
