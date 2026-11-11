(function () {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const TZ = "Europe/Moscow";

  // Built-in data. If a Google Sheet is connected (SHEET_ID below), it replaces these on load.
  let GROUPS = [
    {
      id: "kids", name: "Малыши", from: 5, to: 7, color: "var(--g-kids)", price: 3200, length: 45,
      text: "Игры на координацию, растяжка, первые стойки и удары. Учимся слушать тренера и работать в команде.",
      sessions: [[1, "17:00"], [3, "17:00"], [5, "10:00"]]
    },
    {
      id: "junior", name: "Дети", from: 8, to: 11, color: "var(--g-junior)", price: 3600, length: 60,
      text: "Базовая техника, ката и физподготовка. Готовимся к первым аттестациям на пояс.",
      sessions: [[0, "17:30"], [2, "17:30"], [4, "17:30"]]
    },
    {
      id: "teen", name: "Подростки", from: 12, to: 15, color: "var(--g-teen)", price: 3800, length: 75,
      text: "Техника, выносливость и контролируемые спарринги в защите. По желанию — подготовка к турнирам.",
      sessions: [[0, "18:45"], [2, "18:45"], [4, "18:45"]]
    },
    {
      id: "adult", name: "Взрослые", from: 16, to: 99, color: "var(--g-adult)", price: 4200, length: 90,
      text: "Для новичков и тех, кто возвращается. Общая физподготовка, техника, спарринги — когда будете готовы.",
      sessions: [[1, "19:00"], [3, "19:00"], [5, "12:00"]]
    }
  ];

  let PASSES = [
    { name: "Пробное", price: "0", note: "Первое занятие в любой группе. Нужна спортивная одежда и вода.", main: false },
    { name: "Месяц", price: "от 3 200", note: "Все занятия своей группы за календарный месяц. Цена зависит от группы.", main: true },
    { name: "Разовое", price: "600", note: "Если ходите нерегулярно или пропустили часть месяца.", main: false }
  ];

  let COACHES = [
    { name: "Андрей Викторович", rank: "3 дан · старший тренер", text: "Ведёт подростков и взрослых. Готовит к соревнованиям, но на турнир никого не тащит: выступать или нет, решает спортсмен." },
    { name: "Екатерина Сергеевна", rank: "1 дан · детский тренер", text: "Ведёт малышей и детей. Половина занятия — игры на координацию, вторая половина — техника. Родители могут смотреть первое занятие из зала." }
  ];

  const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  const DAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

  const BELTS = [
    {
      name: "Белый", kyu: "новичок", color: "#f4f0e8", white: true,
      skills: ["Знает правила зала и поклоны", "Держит базовую стойку", "Выполняет прямые удары руками"],
      note: "С него начинают все, даже взрослые."
    },
    {
      name: "Оранжевый", kyu: "10–9 кю", color: "#e8792b",
      skills: ["Основные блоки и удары ногами", "Первые ката", "Выдерживает полную тренировку"],
      note: "Обычно первая аттестация — через полгода регулярных занятий."
    },
    {
      name: "Синий", kyu: "8–7 кю", color: "#2f5fb8",
      skills: ["Комбинации из нескольких ударов", "Работа в паре на технику", "Начинает спарринги в защите"],
      note: "На синем поясе впервые сдают спарринги."
    },
    {
      name: "Жёлтый", kyu: "6–5 кю", color: "#e3c234",
      skills: ["Удары ногами в голову", "Более сложные ката", "Уверенно спаррингует"],
      note: "Здесь многие пробуют себя на первых турнирах."
    },
    {
      name: "Зелёный", kyu: "4–3 кю", color: "#2f8f5b",
      skills: ["Тактика боя", "Помогает тренеру с младшими", "Высокая выносливость"],
      note: "Средний уровень: техника уже своя, а не заученная."
    },
    {
      name: "Коричневый", kyu: "2–1 кю", color: "#6b3f22",
      skills: ["Все ката программы", "Готовится к экзамену на чёрный пояс", "Может вести разминку"],
      note: "Последний шаг перед мастерским уровнем."
    },
    {
      name: "Чёрный", kyu: "1 дан и выше", color: "#0b0a09", stripes: 1,
      skills: ["Мастерский уровень", "Право вести занятия", "Дальше — новые даны"],
      note: "Чёрный пояс — не финиш, а начало настоящего пути."
    }
  ];

  const state = { age: 8, filter: "all", belt: 0, slot: null };

  function groupFor(age) {
    if (age < minAge()) return null;
    return GROUPS.find((g) => age >= g.from && age <= g.to) || GROUPS[GROUPS.length - 1];
  }

  function minAge() {
    return Math.min(...GROUPS.map((g) => g.from));
  }

  function formatPrice(n) {
    return n.toLocaleString("ru-RU").replace(/ /g, " ");
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function sessionDays(group) {
    return group.sessions.map(([d, t]) => `${DAYS_SHORT[d]} ${t}`).join(", ");
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "style") node.style.cssText = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  }

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function animate(node, keyframes, options) {
    if (!calm && node.animate) node.animate(keyframes, { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards", ...options });
  }

  function renderMatch() {
    const age = state.age;
    $("#age-out").replaceChildren(String(age), el("small", { text: plural(age, "год", "года", "лет") }));

    const box = $("#match");
    const group = groupFor(age);
    const key = group ? group.id : "none";
    if (key === state.matchKey) return;
    const first = state.matchKey === undefined;
    state.matchKey = key;
    box.replaceChildren();
    if (!first) {
      animate(box, [{ opacity: 0, transform: "translateX(16px)" }, { opacity: 1, transform: "none" }]);
    }

    if (!group) {
      box.style.setProperty("--match", "var(--c-line)");
      box.append(
        el("p", { class: "match__group", text: "Чуть подождать" }),
        el("p", { class: "match__text", text: `Набираем с ${minAge()} лет: раньше детям трудно держать внимание целое занятие. Приходите чуть позже — а пока можно посмотреть занятие младшей группы вместе с ребёнком.` })
      );
      return;
    }

    box.style.setProperty("--match", group.color);
    box.append(
      el("p", { class: "match__ages", text: group.to >= 99 ? `${group.from}+ лет` : `${group.from}–${group.to} лет` }),
      el("p", { class: "match__group", text: group.name }),
      el("p", { class: "match__text", text: group.text }),
      el("ul", { class: "match__meta" },
        el("li", { text: sessionDays(group) }),
        el("li", { text: `${group.length} мин` }),
        el("li", { text: `${formatPrice(group.price)} ₽ в месяц` })
      ),
      el("div", { class: "match__actions" },
        el("a", { class: "btn btn--red", href: "#trial", "data-group": group.id, text: "Пробное в эту группу" }),
        el("a", { class: "btn btn--ghost", href: "#schedule", "data-filter": group.id, text: "Смотреть расписание" })
      )
    );
  }

  $("#age").addEventListener("input", (e) => {
    state.age = Number(e.target.value);
    renderMatch();
  });

  $("#match").addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    if (link.dataset.group) selectTrialGroup(link.dataset.group);
    if (link.dataset.filter) setFilter(link.dataset.filter);
  });

  function renderGroups() {
    const list = $("#groups-list");
    list.replaceChildren();
    for (const g of GROUPS) {
      list.append(el("li", { class: "group", style: `--g: ${g.color}; --i: ${list.children.length}`, "data-reveal": "" },
        el("h3", { text: g.name }),
        el("p", { class: "group__ages" }, g.to >= 99 ? `${g.from}+` : `${g.from}–${g.to}`, el("small", { text: " лет" })),
        el("p", { class: "group__text", text: g.text }),
        el("p", { class: "group__when", text: `${sessionDays(g)} · ${g.length} мин` }),
        el("p", { class: "group__price" }, `${formatPrice(g.price)} ₽ `, el("span", { text: "в месяц" }))
      ));
    }
    watchReveal(list.querySelectorAll("[data-reveal]"));
  }

  function priceText(value) {
    const v = String(value ?? "").trim();
    // "3200" -> "3 200", "от 3200" -> "от 3 200"; any other wording is shown as typed
    return v.replace(/\d[\d\s]*/g, (n) => formatPrice(Number(n.replace(/\s/g, ""))) + (n.endsWith(" ") ? " " : ""));
  }

  function renderPasses() {
    const list = $("#prices-list");
    list.replaceChildren();
    PASSES.forEach((pass, i) => {
      const sum = el("p", { class: "price__sum" }, `${priceText(pass.price)} `);
      if (/\d/.test(pass.price)) sum.append(el("span", { text: "₽" }));
      list.append(el("li", { class: "price" + (pass.main ? " price--main" : ""), "data-reveal": "", style: `--i: ${i}` },
        el("h3", { text: pass.name }), sum, el("p", { class: "price__note", text: pass.note || "" })
      ));
    });
    watchReveal(list.querySelectorAll("[data-reveal]"));
  }

  function initials(name) {
    return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  }

  function renderCoaches() {
    const box = $("#coaches");
    box.replaceChildren();
    COACHES.forEach((c, i) => {
      box.append(el("article", { class: "coach", "data-reveal": "", style: `--i: ${i}` },
        el("div", { class: "coach__avatar", "aria-hidden": "true", text: initials(c.name) }),
        el("div", { class: "coach__body" },
          el("h3", { text: c.name }),
          c.rank ? el("p", { class: "coach__rank", text: c.rank }) : "",
          el("p", { class: "coach__text", text: c.text || "" })
        )
      ));
    });
    watchReveal(box.querySelectorAll("[data-reveal]"));
  }

  function beltStrip(belt) {
    const strip = el("div", { class: "belt" + (belt.white ? " belt--white" : ""), style: `--belt: ${belt.color}` });
    if (belt.stripes) {
      const s = el("div", { class: "belt__stripes" });
      for (let i = 0; i < belt.stripes; i++) s.append(el("i"));
      strip.append(s);
    }
    return strip;
  }

  function renderBelts() {
    const list = $("#belt-list");
    BELTS.forEach((belt, i) => {
      const btn = el("button", { class: "belt-btn", type: "button", "aria-pressed": String(i === state.belt), "data-belt": String(i) },
        beltStrip(belt),
        el("span", { class: "belt-btn__name", text: belt.name }),
        el("span", { class: "belt-btn__kyu", text: belt.kyu })
      );
      list.append(el("li", {}, btn));
    });
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-belt]");
      if (!btn) return;
      state.belt = Number(btn.dataset.belt);
      list.querySelectorAll("[data-belt]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      renderBeltCard();
    });
    renderBeltCard();
  }

  function renderBeltCard() {
    const belt = BELTS[state.belt];
    const card = $("#belt-card");
    card.replaceChildren(
      beltStrip(belt),
      el("h3", { class: "belt-card__title", text: `${belt.name} пояс` }),
      el("p", { class: "belt-card__kyu", text: belt.kyu }),
      el("ul", { class: "belt-card__list" }, ...belt.skills.map((s) => el("li", { text: s }))),
      el("p", { class: "belt-card__note", text: belt.note })
    );
    if (state.beltShown) {
      [...card.children].forEach((child, i) => {
        animate(child, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { delay: i * 45 });
      });
      animate(card.firstChild, [{ transform: "scaleX(0.4)" }, { transform: "none" }], { duration: 500 });
    }
    state.beltShown = true;
  }

  function moscowNow() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(new Date());
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    // a "local" Date that carries Moscow wall-clock time, enough for day maths
    return new Date(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  }

  function weekdayIndex(date) {
    return (date.getDay() + 6) % 7; // Monday = 0
  }

  function renderFilters() {
    const box = $("#filters");
    box.replaceChildren();
    if (!GROUPS.some((g) => g.id === state.filter)) state.filter = "all";
    const items = [{ id: "all", name: "Все группы" }, ...GROUPS];
    for (const g of items) {
      const chip = el("button", { class: "chip", type: "button", "data-filter": g.id, "aria-pressed": String(g.id === state.filter) });
      if (g.color) chip.append(el("span", { class: "chip__dot", style: `--g: ${g.color}`, "aria-hidden": "true" }));
      chip.append(g.name);
      box.append(chip);
    }
    if (box.dataset.ready) return;
    box.dataset.ready = "1";
    box.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (chip) setFilter(chip.dataset.filter);
    });
  }

  function setFilter(id) {
    state.filter = id;
    $("#filters").querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.filter === id)));
    renderWeek();
    $("#week").querySelectorAll(".session").forEach((node, i) => {
      animate(node, [{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }], { delay: i * 35 });
    });
  }

  function endTime(start, minutes) {
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function renderWeek() {
    const week = $("#week");
    week.replaceChildren();
    const today = weekdayIndex(moscowNow());

    DAYS.forEach((dayName, d) => {
      const sessions = GROUPS
        .filter((g) => state.filter === "all" || g.id === state.filter)
        .flatMap((g) => g.sessions.filter(([day]) => day === d).map(([, time]) => ({ g, time })))
        .sort((a, b) => a.time.localeCompare(b.time));

      const head = el("h3", { class: "day__name" }, dayName);
      if (d === today) head.append(el("small", { text: "сегодня" }));

      const day = el("div", { class: "day" + (d === today ? " day--today" : "") }, head);
      if (!sessions.length) day.append(el("p", { class: "day__empty", text: "Нет занятий" }));
      for (const { g, time } of sessions) {
        day.append(el("div", { class: "session", style: `--g: ${g.color}` },
          el("p", { class: "session__time", text: `${time}–${endTime(time, g.length)}` }),
          el("p", { class: "session__group", text: g.name })
        ));
      }
      week.append(day);
    });
  }

  const form = $("#trial-form");
  const groupSelect = $("#f-group");

  function fillGroupSelect() {
    groupSelect.replaceChildren();
    for (const g of GROUPS) {
      groupSelect.append(el("option", { value: g.id, text: `${g.name}, ${g.to >= 99 ? g.from + "+" : g.from + "–" + g.to} лет` }));
    }
    groupSelect.value = (groupFor(state.age) || GROUPS[0]).id;
  }

  function selectTrialGroup(id) {
    groupSelect.value = id;
    renderSlots();
  }

  // Next four trainings of the group, skipping ones that start in less than 2 hours.
  function upcoming(group, count = 4) {
    const now = moscowNow();
    const result = [];
    for (let offset = 0; offset < 21 && result.length < count; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const wd = weekdayIndex(date);
      for (const [d, time] of group.sessions) {
        if (d !== wd) continue;
        const [h, m] = time.split(":").map(Number);
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
        if (start - now < 2 * 60 * 60 * 1000) continue;
        result.push({ start, time });
      }
    }
    return result.sort((a, b) => a.start - b.start).slice(0, count);
  }

  function dayLabel(date) {
    const now = moscowNow();
    const diff = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    if (diff === 0) return "Сегодня";
    if (diff === 1) return "Завтра";
    const wd = DAYS_SHORT[weekdayIndex(date)];
    return `${wd[0].toUpperCase()}${wd.slice(1)}, ${date.getDate()} ${date.toLocaleString("ru-RU", { month: "short" }).replace(".", "")}`;
  }

  function renderSlots() {
    const group = GROUPS.find((g) => g.id === groupSelect.value);
    const box = $("#slots");
    box.replaceChildren();
    state.slot = null;
    $("#slot-error").textContent = "";

    const slots = upcoming(group);
    if (!slots.length) box.append(el("p", { class: "field__hint", text: "Расписание этой группы уточняйте по телефону — тренер подберёт время." }));
    slots.forEach((s, i) => {
      const id = `slot-${i}`;
      const input = el("input", { type: "radio", name: "slot", id, value: s.start.toISOString() });
      input.addEventListener("change", () => { state.slot = s; $("#slot-error").textContent = ""; });
      box.append(el("label", { class: "slot", for: id }, input,
        el("span", {}, el("strong", { text: s.time }), dayLabel(s.start))
      ));
    });

    $("#child-field").hidden = group.id === "adult";
  }

  groupSelect.addEventListener("change", renderSlots);

  // Phone mask: +7 (900) 000-12-34
  const phone = $("#f-phone");
  function formatPhone(raw) {
    // Once formatted the value starts with "+7", otherwise a leading 8 or 7 is the country code.
    let p;
    if (raw.trimStart().startsWith("+7")) {
      p = raw.trimStart().slice(2).replace(/\D/g, "");
    } else {
      const d = raw.replace(/\D/g, "");
      p = d[0] === "8" || d[0] === "7" ? d.slice(1) : d;
    }
    p = p.slice(0, 10);
    let out = "+7";
    if (p.length) out += " (" + p.slice(0, 3);
    if (p.length >= 3) out += ")";
    if (p.length > 3) out += " " + p.slice(3, 6);
    if (p.length > 6) out += "-" + p.slice(6, 8);
    if (p.length > 8) out += "-" + p.slice(8, 10);
    return out;
  }
  let lastPhone = "";
  phone.addEventListener("input", (e) => {
    let value = phone.value;
    // Backspace over ")" or "-" would be undone by the formatting, so take the digit before it too.
    if (e.inputType === "deleteContentBackward" && value.replace(/\D/g, "") === lastPhone.replace(/\D/g, "")) {
      value = value.replace(/\d(\D*)$/, "$1");
    }
    const digits = value.replace(/\D/g, "");
    const onlyPrefix = value.startsWith("+7") && digits.length <= 1;
    phone.value = !digits || onlyPrefix ? "" : formatPhone(value);
    lastPhone = phone.value;
  });

  function setError(input, errorEl, message) {
    errorEl.textContent = message;
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
    return !message;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#f-name");
    const digits = phone.value.replace(/\D/g, "");

    const checks = [
      setError(null, $("#slot-error"), state.slot || !$("#slots input") ? "" : "Выберите тренировку"),
      setError(name, $("#name-error"), name.value.trim().length >= 2 ? "" : "Как к вам обращаться?"),
      setError(phone, $("#phone-error"), digits.length === 11 ? "" : "Нужен номер целиком: +7 и 10 цифр"),
      setError(null, $("#consent-error"), $("#f-consent").checked ? "" : "Без согласия не сможем записать")
    ];
    if (checks.includes(false)) {
      const first = form.querySelector('[aria-invalid="true"]') || (!state.slot && form.querySelector('[name="slot"]'));
      if (first) first.focus();
      return;
    }

    const group = GROUPS.find((g) => g.id === groupSelect.value);
    $("#done-summary").textContent = state.slot
      ? `${group.name}: ${dayLabel(state.slot.start).toLowerCase()}, ${state.slot.time}–${endTime(state.slot.time, group.length)}`
      : `${group.name}: время тренер согласует по телефону`;
    form.hidden = true;
    $("#done").hidden = false;
    $("#done").focus();
  });

  $("#again").addEventListener("click", () => {
    form.reset();
    ["#f-name", "#f-phone"].forEach((s) => $(s).removeAttribute("aria-invalid"));
    ["#name-error", "#phone-error", "#consent-error"].forEach((s) => ($(s).textContent = ""));
    groupSelect.value = (groupFor(state.age) || GROUPS[0]).id;
    renderSlots();
    $("#done").hidden = true;
    form.hidden = false;
    $("#f-name").focus();
  });

  const PHOTOS = [
    { src: "media/gym-1", alt: "Тренер показывает технику, дети смотрят" },
    { src: "media/gym-2", alt: "Начало занятия: группа слушает тренера" },
    { src: "media/gym-3", alt: "Детская группа в стойке" },
    { src: "media/gym-4", alt: "Отработка ударов ногами" },
    { src: "media/gym-5", alt: "Удар ногой в паре с тренером" }
  ];

  function setupClip() {
    const video = $("#clip");
    const toggle = $("#clip-toggle");
    const icon = $("#clip-icon");
    const sync = () => {
      const paused = video.paused;
      icon.setAttribute("d", paused ? "M8 5v14l11-7z" : "M7 5h4v14H7zM13 5h4v14h-4z");
      toggle.setAttribute("aria-label", paused ? "Включить видео" : "Поставить видео на паузу");
    };
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    toggle.addEventListener("click", () => (video.paused ? video.play() : video.pause()));
    sync();
    if (calm) return; // no autoplay for people who asked for less motion

    // play only while the clip is on screen: saves battery and data on phones
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !video.dataset.userPaused) video.play().catch(() => {});
        else if (!entry.isIntersecting) video.pause();
      }, { threshold: 0.35 }).observe(video);
    }
    toggle.addEventListener("click", () => { video.dataset.userPaused = video.paused ? "1" : ""; });
  }

  function setupGallery() {
    const list = $("#gallery");
    PHOTOS.forEach((photo, i) => {
      const img = el("img", { src: `${photo.src}${i === 0 ? "" : "-s"}.webp`, alt: photo.alt, loading: "lazy", decoding: "async" });
      const btn = el("button", { type: "button", "data-photo": String(i), "aria-label": `Открыть фото: ${photo.alt}` }, img);
      list.append(el("li", {}, btn));
    });

    const box = $("#lightbox");
    const img = $("#lb-img");
    let current = 0;

    function show(i, dir = 0) {
      current = (i + PHOTOS.length) % PHOTOS.length;
      const photo = PHOTOS[current];
      img.src = `${photo.src}.webp`;
      img.alt = photo.alt;
      $("#lb-caption").textContent = photo.alt;
      $("#lb-count").textContent = `${current + 1} / ${PHOTOS.length}`;
      if (dir) animate(img, [{ opacity: 0, transform: `translateX(${dir * 40}px)` }, { opacity: 1, transform: "none" }], { duration: 280 });
    }

    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-photo]");
      if (!btn) return;
      show(Number(btn.dataset.photo));
      box.showModal();
      animate(img, [{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 300 });
    });
    $("#lb-close").addEventListener("click", () => box.close());
    $("#lb-prev").addEventListener("click", () => show(current - 1, -1));
    $("#lb-next").addEventListener("click", () => show(current + 1, 1));
    box.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(current - 1, -1);
      if (e.key === "ArrowRight") show(current + 1, 1);
    });
    // click on the dark area around the photo closes it
    let swiped = false;
    box.addEventListener("click", (e) => {
      if (swiped) { swiped = false; return; } // the click that ends a swipe is not a "close"
      if (e.target === box || e.target.id === "lb-stage") box.close();
    });
    box.addEventListener("close", () => {
      const btn = list.querySelector(`[data-photo="${current}"]`);
      if (btn) btn.focus();
    });

    let startX = null;
    const stage = $("#lb-stage");
    stage.addEventListener("pointerdown", (e) => { startX = e.clientX; });
    stage.addEventListener("pointerup", (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) {
        swiped = true;
        show(current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      }
    });
  }

  const WORDS = [
    { jp: "押忍", term: "Осу", meaning: "Приветствие", text: "Говорят при входе в зал, в ответ тренеру и вместо «понял». Главное слово кёкусинкай." },
    { jp: "道場", term: "Додзё", meaning: "Зал", text: "Место тренировок. Входя и выходя, делают поклон." },
    { jp: "先生", term: "Сэнсэй", meaning: "Тренер", text: "Так обращаются к тренеру. Старший ученик — сэмпай." },
    { jp: "帯", term: "Оби", meaning: "Пояс", text: "Его не стирают и завязывают особым узлом — научим на первом занятии." },
    { jp: "空手着", term: "Каратэги", meaning: "Кимоно", text: "Форма для тренировок. На пробное занятие можно прийти в спортивной одежде." },
    { jp: "基本", term: "Кихон", meaning: "Базовая техника", text: "Стойки, удары и блоки, которые повторяют на каждой тренировке." },
    { jp: "型", term: "Ката", meaning: "Форма", text: "Связка движений против воображаемого соперника. Сдаётся на каждой аттестации." },
    { jp: "組手", term: "Кумитэ", meaning: "Спарринг", text: "Поединок в паре. В детских группах — только в защите и под контролем тренера." }
  ];
  const COUNT = [
    ["ити", "いち"], ["ни", "に"], ["сан", "さん"], ["си", "し"], ["го", "ご"],
    ["року", "ろく"], ["сити", "しち"], ["хати", "はち"], ["ку", "く"], ["дзю", "じゅう"]
  ];

  function setFlip(card, open) {
    const w = card._word;
    card.setAttribute("aria-pressed", String(open));
    card.setAttribute("aria-label", open ? `${w.term} — ${w.meaning}. ${w.text}` : `${w.term}: показать перевод`);
    card.querySelector(".flip__back").setAttribute("aria-hidden", String(!open));
  }

  function setupDictionary() {
    const list = $("#dict");
    WORDS.forEach((w, i) => {
      const card = el("button", { class: "flip", type: "button", "aria-pressed": "false", "aria-label": `${w.term}: показать перевод` },
        el("span", { class: "flip__inner" },
          el("span", { class: "flip__face flip__front" },
            el("span", { class: "flip__jp", lang: "ja", text: w.jp }),
            el("span", {}, el("span", { class: "flip__term", text: w.term }), el("br"), el("span", { class: "flip__hint", text: "нажмите, чтобы узнать" }))
          ),
          el("span", { class: "flip__face flip__back", "aria-hidden": "true" },
            el("span", { class: "flip__meaning", text: w.meaning }),
            el("span", { class: "flip__text", text: w.text })
          )
        )
      );
      card.addEventListener("click", () => {
        const open = card.getAttribute("aria-pressed") !== "true";
        // one word at a time: the previously opened card turns back
        if (open) list.querySelectorAll('.flip[aria-pressed="true"]').forEach((other) => setFlip(other, false));
        setFlip(card, open);
      });
      card._word = w;
      list.append(el("li", { "data-reveal": "", style: `--i: ${i}` }, card));
    });

    const row = $("#count");
    const synth = window.speechSynthesis;
    let jaVoice = null;
    let ruVoice = null;
    const pickVoices = () => {
      const voices = synth ? synth.getVoices() : [];
      jaVoice = voices.find((v) => v.lang.toLowerCase().startsWith("ja")) || null;
      ruVoice = voices.find((v) => v.lang.toLowerCase().startsWith("ru")) || null;
    };
    if (synth) { pickVoices(); synth.addEventListener?.("voiceschanged", pickVoices); }

    // Japanese voice if the browser has one; otherwise the Russian voice reads the transcription.
    function speak(word, kana) {
      if (!synth) return;
      const voice = jaVoice || ruVoice;
      const say = new SpeechSynthesisUtterance(jaVoice ? kana : word);
      if (voice) { say.voice = voice; say.lang = voice.lang; } else { say.lang = "ru-RU"; }
      say.rate = 0.85;
      synth.cancel();
      synth.speak(say);
    }

    COUNT.forEach(([word, kana], i) => {
      const btn = el("button", { class: "count__btn", type: "button", "aria-label": `${i + 1} — ${word}` },
        el("span", { class: "count__num", text: String(i + 1) }),
        el("span", { class: "count__word", text: word })
      );
      btn.addEventListener("click", () => {
        row.querySelectorAll(".is-on").forEach((b) => b.classList.remove("is-on"));
        btn.classList.add("is-on");
        setTimeout(() => btn.classList.remove("is-on"), 700);
        speak(word, kana);
      });
      row.append(el("li", {}, btn));
    });
  }

  // The number is made up: instead of a call that goes nowhere, explain what a real site would do.
  let toastTimer;
  function toast(text) {
    const box = $("#toast");
    box.textContent = text;
    box.hidden = false;
    animate(box, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 220 });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 4000);
  }
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="tel:"]');
    if (!link) return;
    e.preventDefault();
    toast("Это демо, номер вымышленный. На сайте клуба здесь сразу откроется звонок.");
  });
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-messenger]");
    if (!link) return;
    e.preventDefault();
    link.classList.remove("is-pressed");
    void link.offsetWidth; // restart the ring animation on repeated clicks
    if (!calm) link.classList.add("is-pressed");
    const where = link.dataset.messenger === "tg" ? "Telegram" : "ВКонтакте";
    toast(`Это демо. На сайте клуба здесь откроется бот клуба в ${where}: запись на пробное, расписание и напоминания.`);
  });

  function drawEnso() {
    const enso = $(".enso");
    const reveal = $(".enso__reveal");
    const brush = $("#enso-brush");
    if (calm || !enso || !reveal.getTotalLength) return;

    enso.classList.add("is-brushing");
    const length = reveal.getTotalLength();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const DELAY = 250, DRAW = 1500, LIFT = 450;
    let start = null;

    // the brush tip sits on the stroke; the handle leans a little and sways with the movement
    function place(p, lift = 0) {
      const pt = reveal.getPointAtLength(p * length);
      const tilt = 24 + 10 * Math.sin(p * Math.PI * 2);
      brush.setAttribute("transform", `translate(${pt.x + lift * 60} ${pt.y - lift * 90}) rotate(${tilt + lift * 10})`);
    }

    function frame(now) {
      if (start === null) start = now;
      const t = now - start - DELAY;
      if (t < 0) { requestAnimationFrame(frame); return; }

      if (t <= DRAW) {
        const p = ease(t / DRAW);
        reveal.style.strokeDashoffset = String(1 - p);
        brush.style.opacity = String(Math.min(1, t / 120));
        place(p);
      } else {
        reveal.style.strokeDashoffset = "0";
        const l = Math.min(1, (t - DRAW) / LIFT);
        brush.style.opacity = String(1 - l);
        place(1, l * l);
        if (l >= 1) return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // The club edits groups, schedule and prices in a Google Sheet ("Anyone with the link can view").
  // Paste the sheet id here; empty = the built-in data above is used.
  const SHEET_ID = "";
  // Or the admin panel's Apps Script address (…/exec): then the sheet doesn't even need to be public.
  const API_URL = "https://script.google.com/macros/s/AKfycbyq9DHv9rtziBYVdpy2DiQ5KOpYz_I-dVVKQq_8AG-KbWKhr3ZW4w8OqGv1VNOhnfhD/exec";
  const GROUP_COLORS = ["var(--g-kids)", "var(--g-junior)", "var(--g-teen)", "var(--g-adult)", "#7a4fc9", "#1f8a8a", "#b8641d"];
  const DAY_INDEX = { пн: 0, вт: 1, ср: 2, чт: 3, пт: 4, сб: 5, по: 0, вто: 1, сре: 2, чет: 3, пят: 4, суб: 5 };

  // RFC 4180-ish: quoted fields, doubled quotes, commas and line breaks inside quotes.
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
  }

  async function loadSheet(name) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    const [, ...rows] = parseCsv(await res.text()); // first row is the header
    return rows;
  }

  const toNumber = (v) => Number(String(v).replace(/\s|₽|%/g, "").replace(",", "."));
  const toTime = (v) => {
    const m = String(v).match(/(\d{1,2})[:.](\d{2})/);
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
  };
  const toDay = (v) => {
    const key = String(v).toLowerCase().replace(/[^а-яё]/g, "");
    return DAY_INDEX[key.slice(0, 3)] ?? DAY_INDEX[key.slice(0, 2)] ?? null;
  };

  function groupsFromSheet(groupRows, scheduleRows) {
    const groups = [];
    groupRows.forEach(([name, from, to, price, length, text]) => {
      const g = {
        id: `g${groups.length}`,
        name,
        from: toNumber(from),
        to: to ? toNumber(to) : 99, // empty "до" means "and older"
        price: toNumber(price),
        length: toNumber(length) || 60,
        text: text || "",
        color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
        sessions: []
      };
      if (name && Number.isFinite(g.from) && Number.isFinite(g.to) && Number.isFinite(g.price)) groups.push(g);
    });
    const byName = new Map(groups.map((g) => [g.name.toLowerCase(), g]));
    scheduleRows.forEach(([name, day, time]) => {
      const g = byName.get(String(name).toLowerCase());
      const d = toDay(day), t = toTime(time);
      if (g && d !== null && t) g.sessions.push([d, t]);
    });
    groups.forEach((g) => g.sessions.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])));
    return groups.sort((a, b) => a.from - b.from);
  }

  function applySettings(rows) {
    const get = (label) => {
      const row = rows.find(([key]) => key.toLowerCase().startsWith(label));
      return row && row[1] ? row[1] : null;
    };
    const discount = get("скидка"), phone = get("телефон"), address = get("адрес"), hours = get("часы");
    if (discount && Number.isFinite(toNumber(discount))) $("#discount").textContent = String(toNumber(discount));
    if (address) $("#club-address").textContent = address;
    if (hours) $("#club-hours").textContent = hours;
    if (phone) {
      const link = $("#club-phone");
      link.textContent = phone;
      link.href = `tel:+${phone.replace(/\D/g, "").replace(/^8/, "7")}`;
    }
  }

  function rerenderGroups() {
    // the slider starts one year below the youngest group, so "too early" can still be shown
    const slider = $("#age");
    slider.min = String(Math.max(1, minAge() - 1));
    if (Number(slider.value) < Number(slider.min)) { slider.value = slider.min; state.age = Number(slider.min); }
    state.matchKey = undefined;
    renderMatch();
    renderGroups();
    renderFilters();
    renderWeek();
    fillGroupSelect();
    renderSlots();
  }

  // Same row shapes as the sheet, so both sources go through one parser.
  async function loadFromApi() {
    const res = await fetch(API_URL, { cache: "no-store" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "API error");
    const { groups = [], schedule = [], settings = {}, passes, coaches } = json.data;
    // these two are optional: an older script or an empty sheet keeps the built-in ones
    if (Array.isArray(passes) && passes.length) { PASSES = passes; renderPasses(); }
    if (Array.isArray(coaches) && coaches.length) { COACHES = coaches; renderCoaches(); }
    return [
      groups.map((g) => [g.name, g.from, g.to ?? "", g.price, g.length, g.text]),
      schedule.map((x) => [x.group, x.day, x.time]),
      [["разовое", settings.single], ["скидка", settings.discount], ["телефон", settings.phone], ["адрес", settings.address], ["часы", settings.hours]]
        .filter(([, v]) => v !== undefined && v !== "")
    ];
  }

  async function connectSheet() {
    if (!SHEET_ID && !API_URL) return;
    try {
      const [groupRows, scheduleRows, settingsRows] = API_URL
        ? await loadFromApi()
        : await Promise.all([loadSheet("Группы"), loadSheet("Расписание"), loadSheet("Настройки").catch(() => [])]);
      const groups = groupsFromSheet(groupRows, scheduleRows);
      if (!groups.length) throw new Error("в таблице нет ни одной заполненной группы");
      GROUPS = groups;
      rerenderGroups();
      applySettings(settingsRows);
    } catch (err) {
      // The site keeps working on the built-in data; the reason is only for whoever opens the console.
      console.warn("Google Таблица не подключилась, показаны встроенные данные:", err.message);
    }
  }

  let revealer = null;
  // Cards rebuilt after the sheet arrives join the same scroll animation (or just show up).
  function watchReveal(nodes) {
    if (revealer) nodes.forEach((n) => revealer.observe(n));
    else if (calm || !("IntersectionObserver" in window)) nodes.forEach((n) => n.classList.add("is-in"));
  }

  function setupReveal() {
    const items = document.querySelectorAll("[data-reveal]");
    // siblings appear one after another
    items.forEach((node) => {
      if (node.style.getPropertyValue("--i")) return;
      const siblings = [...node.parentElement.children].filter((c) => c.hasAttribute("data-reveal"));
      if (siblings.length > 1) node.style.setProperty("--i", siblings.indexOf(node));
    });
    if (calm || !("IntersectionObserver" in window)) {
      items.forEach((node) => node.classList.add("is-in"));
      return;
    }
    revealer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        revealer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    items.forEach((node) => revealer.observe(node));
  }

  function setupHeader() {
    const header = $(".header");
    const ring = $(".enso__ring");
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle("is-scrolled", window.scrollY > 8);
        // the brush ring slowly turns while the page scrolls
        if (!calm && window.scrollY < 1200) ring.style.setProperty("--spin", `${window.scrollY * 0.06}deg`);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (!("IntersectionObserver" in window)) return;
    const links = new Map([...document.querySelectorAll(".nav a")].map((a) => [a.getAttribute("href").slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const link = links.get(entry.target.id);
        if (link) link.classList.toggle("is-active", entry.isIntersecting);
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((_, id) => { const section = document.getElementById(id); if (section) spy.observe(section); });
  }

  renderMatch();
  renderGroups();
  renderPasses();
  renderCoaches();
  renderBelts();
  renderFilters();
  renderWeek();
  fillGroupSelect();
  renderSlots();
  setupGallery();
  setupDictionary();
  setupClip();
  setupReveal();
  setupHeader();
  drawEnso();
  connectSheet();
})();
