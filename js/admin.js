(function () {
  "use strict";

  // Web app address of the Google Apps Script (…/exec). Empty = demo mode on the built-in data.
  const API_URL = "https://script.google.com/macros/s/AKfycbyq9DHv9rtziBYVdpy2DiQ5KOpYz_I-dVVKQq_8AG-KbWKhr3ZW4w8OqGv1VNOhnfhD/exec";
  const DEMO_PASSWORD = "tetsu";
  const DAYS = [["пн", "Понедельник"], ["вт", "Вторник"], ["ср", "Среда"], ["чт", "Четверг"], ["пт", "Пятница"], ["сб", "Суббота"]];

  const DEMO_DATA = {
    groups: [
      { name: "Малыши", from: 5, to: 7, price: 3200, length: 45, text: "Игры на координацию, растяжка, первые стойки и удары. Учимся слушать тренера и работать в команде." },
      { name: "Дети", from: 8, to: 11, price: 3600, length: 60, text: "Базовая техника, ката и физподготовка. Готовимся к первым аттестациям на пояс." },
      { name: "Подростки", from: 12, to: 15, price: 3800, length: 75, text: "Техника, выносливость и контролируемые спарринги в защите. По желанию — подготовка к турнирам." },
      { name: "Взрослые", from: 16, to: null, price: 4200, length: 90, text: "Для новичков и тех, кто возвращается. Общая физподготовка, техника, спарринги — когда будете готовы." }
    ],
    schedule: [
      ["Малыши", "вт", "17:00"], ["Малыши", "чт", "17:00"], ["Малыши", "сб", "10:00"],
      ["Дети", "пн", "17:30"], ["Дети", "ср", "17:30"], ["Дети", "пт", "17:30"],
      ["Подростки", "пн", "18:45"], ["Подростки", "ср", "18:45"], ["Подростки", "пт", "18:45"],
      ["Взрослые", "вт", "19:00"], ["Взрослые", "чт", "19:00"], ["Взрослые", "сб", "12:00"]
    ].map(([group, day, time]) => ({ group, day, time })),
    passes: [
      { name: "Пробное", price: "0", note: "Первое занятие в любой группе. Нужна спортивная одежда и вода.", main: false },
      { name: "Месяц", price: "от 3 200", note: "Все занятия своей группы за календарный месяц. Цена зависит от группы.", main: true },
      { name: "Разовое", price: "600", note: "Если ходите нерегулярно или пропустили часть месяца.", main: false }
    ],
    coaches: [
      { name: "Андрей Викторович", rank: "3 дан · старший тренер", text: "Ведёт подростков и взрослых. Готовит к соревнованиям, но на турнир никого не тащит: выступать или нет, решает спортсмен." },
      { name: "Екатерина Сергеевна", rank: "1 дан · детский тренер", text: "Ведёт малышей и детей. Половина занятия — игры на координацию, вторая половина — техника. Родители могут смотреть первое занятие из зала." }
    ],
    settings: { discount: "15", phone: "+7 (900) 000-12-34", address: "ул. Спортивная, 5, вход со двора, 2 этаж", hours: "Пн–Сб, 10:00–21:00" }
  };

  const $ = (s, root = document) => root.querySelector(s);
  const demo = !API_URL;
  let data = null;     // what is on screen
  let saved = "";      // JSON of the last saved state, to know about unsaved changes
  let password = "";

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "style") node.style.cssText = v;
      else if (k === "value") node.value = v;
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  }
  const icon = (id) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${id}`);
    svg.append(use);
    return svg;
  };
  const color = (name) => `var(--g-${Math.max(0, data.groups.findIndex((g) => g.name === name)) % 7})`;

  /* ---------- API ---------- */
  // text/plain keeps the request "simple", so Apps Script answers without a CORS preflight.
  async function post(body) {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Ошибка сервера");
    return json;
  }
  async function load() {
    if (demo) {
      try {
        const local = JSON.parse(localStorage.getItem("tetsu-demo") || "null");
        if (local) return local;
      } catch (e) { /* storage may be unavailable */ }
      return structuredClone(DEMO_DATA);
    }
    const res = await fetch(API_URL);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Не удалось загрузить данные");
    return json.data;
  }

  /* ---------- login ---------- */
  if (demo) $("#demo-note").hidden = false;
  try { password = sessionStorage.getItem("tetsu-pass") || ""; } catch (e) { /* ignore */ }
  if (password) start();

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#password");
    const btn = $("#login-btn");
    const error = $("#login-error");
    error.textContent = "";
    if (!input.value) { error.textContent = "Введите пароль"; input.focus(); return; }
    btn.disabled = true;
    btn.textContent = "Проверяю…";
    try {
      if (demo) {
        if (input.value !== DEMO_PASSWORD) throw new Error("Неверный пароль");
      } else {
        await post({ action: "check", password: input.value });
      }
      password = input.value;
      try { sessionStorage.setItem("tetsu-pass", password); } catch (err) { /* ignore */ }
      await start();
    } catch (err) {
      error.textContent = err.message === "Failed to fetch" ? "Нет связи с таблицей. Проверьте интернет." : err.message;
      input.select();
    } finally {
      btn.disabled = false;
      btn.textContent = "Войти";
    }
  });

  async function start() {
    try {
      data = await load();
    } catch (err) {
      $("#login-error").textContent = "Не удалось загрузить данные: " + err.message;
      return;
    }
    normalize();
    saved = JSON.stringify(data);
    $("#login").hidden = true;
    $("#editor").hidden = false;
    renderAll();
    setStatus();
  }

  function normalize() {
    data.groups = (data.groups || []).map((g) => ({ ...g, to: g.to === "" || g.to === undefined ? null : g.to }));
    data.schedule = data.schedule || [];
    // demo starts from the sample values; a real sheet shows exactly what it has, empty fields stay empty
    const base = demo ? DEMO_DATA.settings : { discount: "", phone: "", address: "", hours: "" };
    data.settings = { ...base, ...(data.settings || {}) };
    // a sheet made before these tabs existed has none: start from the cards the site already shows
    if (!Array.isArray(data.passes) || !data.passes.length) {
      data.passes = structuredClone(DEMO_DATA.passes);
      if (data.settings.single) data.passes[2].price = String(data.settings.single);
    }
    if (!Array.isArray(data.coaches) || !data.coaches.length) data.coaches = structuredClone(DEMO_DATA.coaches);
    data.passes = data.passes.map((p) => ({ name: p.name || "", price: String(p.price ?? ""), note: p.note || "", main: p.main === true || p.main === "да" }));
    data.coaches = data.coaches.map((c) => ({ name: c.name || "", rank: c.rank || "", text: c.text || "" }));
    delete data.settings.single;
  }

  // Some embedded browsers silently ignore confirm(), so risky buttons ask right on the page.
  let logoutTimer = 0;
  $("#logout").addEventListener("click", () => {
    const btn = $("#logout");
    if (isDirty() && !logoutTimer) {
      btn.textContent = "Точно?";
      setStatus("error", "Изменения не сохранены. Нажмите ещё раз, чтобы выйти без них");
      logoutTimer = setTimeout(() => { btn.textContent = "Выйти"; logoutTimer = 0; changed(); }, 4000);
      return;
    }
    try { sessionStorage.removeItem("tetsu-pass"); } catch (e) { /* ignore */ }
    location.reload();
  });

  /* ---------- tabs ---------- */
  const tabs = [...document.querySelectorAll(".tab")];
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      selectTab(next);
    });
  });
  function selectTab(tab) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
    }
    if (tab.id === "tab-schedule") renderWeek(); // group names may have changed
  }

  function ask(button, question, onYes) {
    const yes = el("button", { class: "btn btn--red", type: "button", text: "Да, удалить" });
    const no = el("button", { class: "btn", type: "button", text: "Отмена" });
    const box = el("span", { class: "ask", role: "group" }, question, yes, no);
    button.replaceWith(box);
    no.addEventListener("click", () => { box.replaceWith(button); button.focus(); });
    yes.addEventListener("click", onYes);
    no.focus();
  }

  /* ---------- groups ---------- */
  function field(labelText, input) {
    const id = "f" + Math.random().toString(36).slice(2, 9);
    input.id = id;
    return el("div", {}, el("label", { for: id, text: labelText }), input);
  }

  function renderGroups() {
    const box = $("#groups");
    box.replaceChildren();
    data.groups.forEach((g, i) => {
      const name = el("input", { value: g.name, maxlength: "40" });
      const from = el("input", { value: g.from ?? "", inputmode: "numeric" });
      const to = el("input", { value: g.to ?? "", inputmode: "numeric", placeholder: "без границы" });
      const price = el("input", { value: g.price ?? "", inputmode: "numeric" });
      const length = el("input", { value: g.length ?? "", inputmode: "numeric" });
      const text = el("textarea", { maxlength: "300" });
      text.value = g.text || "";
      const count = data.schedule.filter((s) => s.group === g.name).length;

      const oldName = g.name;
      name.addEventListener("change", () => {
        const value = name.value.trim();
        if (!value) { name.value = oldName; return; }
        // keep the schedule attached when a group is renamed
        data.schedule.forEach((s) => { if (s.group === oldName) s.group = value; });
        g.name = value;
        renderGroups();
        changed();
      });
      const num = (input, key, allowEmpty) => input.addEventListener("input", () => {
        const v = input.value.replace(/[^\d]/g, "");
        input.value = v;
        g[key] = v === "" ? (allowEmpty ? null : "") : Number(v);
        input.setAttribute("aria-invalid", String(!allowEmpty && v === ""));
        changed();
      });
      num(from, "from"); num(to, "to", true); num(price, "price"); num(length, "length");
      text.addEventListener("input", () => { g.text = text.value; changed(); });

      const remove = el("button", { class: "btn btn--ghost", type: "button", text: "Удалить группу" });
      remove.addEventListener("click", () => {
        const extra = count ? ` и ${count} ${count === 1 ? "тренировку" : count < 5 ? "тренировки" : "тренировок"} из расписания` : "";
        ask(remove, `Удалить группу${extra}?`, () => {
          data.groups.splice(i, 1);
          data.schedule = data.schedule.filter((s) => s.group !== g.name);
          renderGroups();
          changed();
        });
      });

      box.append(el("article", { class: "card", style: `--g: ${color(g.name)}` },
        el("div", { class: "card__row" },
          field("Название", name), field("Возраст от", from), field("Возраст до", to), field("Цена в месяц, ₽", price), field("Длительность, мин", length)
        ),
        field("Описание для сайта", text),
        el("div", { class: "card__foot" },
          el("p", { class: "card__meta", text: count ? `В расписании: ${count} ${count === 1 ? "тренировка" : count < 5 ? "тренировки" : "тренировок"} в неделю` : "Пока нет тренировок в расписании" }),
          remove
        )
      ));
    });
  }

  $("#add-group").addEventListener("click", () => {
    let n = 1;
    while (data.groups.some((g) => g.name === `Новая группа${n > 1 ? " " + n : ""}`)) n++;
    const last = data.groups[data.groups.length - 1];
    data.groups.push({ name: `Новая группа${n > 1 ? " " + n : ""}`, from: last ? (last.to ?? last.from) + 1 : 6, to: null, price: last ? last.price : 3000, length: 60, text: "" });
    renderGroups();
    changed();
    const cards = $("#groups").children;
    const input = cards[cards.length - 1].querySelector("input");
    input.focus();
    input.select();
  });

  /* ---------- schedule ---------- */
  // A plain list instead of <input type="time">: looks the same everywhere, no AM/PM surprises.
  function timeOptions(current) {
    const list = [];
    for (let h = 7; h <= 22; h++) for (const m of ["00", "15", "30", "45"]) list.push(`${String(h).padStart(2, "0")}:${m}`);
    if (current && !list.includes(current)) list.push(current), list.sort();
    return list;
  }
  function renderWeek() {
    const week = $("#week");
    week.replaceChildren();
    for (const [code, title] of DAYS) {
      const day = el("section", { class: "day", "aria-label": title }, el("h3", { text: title }));
      data.schedule
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.day === code)
        .sort((a, b) => a.s.time.localeCompare(b.s.time))
        .forEach(({ s }) => {
          const group = el("select", { "aria-label": `Группа, ${title}` }, ...data.groups.map((g) => el("option", { value: g.name, text: g.name })));
          group.value = s.group;
          const time = el("select", { "aria-label": `Время, ${title}` }, ...timeOptions(s.time).map((t) => el("option", { value: t, text: t })));
          time.value = s.time;
          const remove = el("button", { class: "icon-btn", type: "button", "aria-label": `Удалить тренировку ${s.group} в ${s.time}` }, icon("i-x"));
          const row = el("div", { class: "slot", style: `--g: ${color(s.group)}` }, group, time, remove);
          group.addEventListener("change", () => { s.group = group.value; row.style.setProperty("--g", color(s.group)); changed(); });
          time.addEventListener("change", () => { s.time = time.value; changed(); });
          remove.addEventListener("click", () => {
            data.schedule.splice(data.schedule.indexOf(s), 1);
            renderWeek();
            changed();
          });
          day.append(row);
        });
      const add = el("button", { class: "add", type: "button", text: "+ тренировка" });
      add.disabled = !data.groups.length;
      add.addEventListener("click", () => {
        data.schedule.push({ group: data.groups[0].name, day: code, time: "18:00" });
        renderWeek();
        changed();
        const rows = week.querySelectorAll(`[aria-label="${title}"] .slot`);
        rows[rows.length - 1].querySelector("select").focus();
      });
      day.append(add);
      week.append(day);
    }
  }

  /* ---------- passes ---------- */
  function renderPasses() {
    const box = $("#passes");
    box.replaceChildren();
    data.passes.forEach((p, i) => {
      const name = el("input", { value: p.name, maxlength: "30" });
      const price = el("input", { value: p.price, maxlength: "20" });
      const note = el("textarea", { maxlength: "200" });
      note.value = p.note;
      const main = el("input", { type: "checkbox" });
      main.checked = p.main;
      name.addEventListener("input", () => { p.name = name.value; name.setAttribute("aria-invalid", String(!name.value.trim())); changed(); });
      price.addEventListener("input", () => { p.price = price.value; changed(); });
      note.addEventListener("input", () => { p.note = note.value; changed(); });
      main.addEventListener("change", () => { p.main = main.checked; changed(); });

      const remove = el("button", { class: "btn btn--ghost", type: "button", text: "Удалить" });
      remove.addEventListener("click", () => ask(remove, "Удалить абонемент?", () => { data.passes.splice(i, 1); renderPasses(); changed(); }));

      box.append(el("article", { class: "card", style: `--g: ${p.main ? "var(--c-red)" : "var(--c-line)"}` },
        el("div", { class: "card__row card__row--3" }, field("Название", name), field("Цена, ₽", price), field("Пояснение", note)),
        el("div", { class: "card__foot" }, el("label", { class: "check" }, main, "Выделить на сайте"), remove)
      ));
    });
  }
  $("#add-pass").addEventListener("click", () => {
    data.passes.push({ name: "Новый абонемент", price: "", note: "", main: false });
    renderPasses();
    changed();
    focusLast("#passes");
  });

  /* ---------- coaches ---------- */
  function renderCoaches() {
    const box = $("#coaches");
    box.replaceChildren();
    data.coaches.forEach((c, i) => {
      const name = el("input", { value: c.name, maxlength: "40", placeholder: "Имя Отчество" });
      const rank = el("input", { value: c.rank, maxlength: "50", placeholder: "2 дан · тренер" });
      const text = el("textarea", { maxlength: "300" });
      text.value = c.text;
      name.addEventListener("input", () => { c.name = name.value; name.setAttribute("aria-invalid", String(!name.value.trim())); changed(); });
      rank.addEventListener("input", () => { c.rank = rank.value; changed(); });
      text.addEventListener("input", () => { c.text = text.value; changed(); });

      const remove = el("button", { class: "btn btn--ghost", type: "button", text: "Удалить тренера" });
      remove.addEventListener("click", () => ask(remove, "Убрать тренера с сайта?", () => { data.coaches.splice(i, 1); renderCoaches(); changed(); }));

      box.append(el("article", { class: "card" },
        el("div", { class: "card__row card__row--3" }, field("Имя", name), field("Пояс, должность", rank), field("О тренере", text)),
        el("div", { class: "card__foot" }, el("span"), remove)
      ));
    });
  }
  $("#add-coach").addEventListener("click", () => {
    data.coaches.push({ name: "", rank: "", text: "" });
    renderCoaches();
    changed();
    focusLast("#coaches");
  });

  function focusLast(selector) {
    const cards = $(selector).children;
    const input = cards[cards.length - 1].querySelector("input");
    input.focus();
    input.select();
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    document.querySelectorAll("[data-setting]").forEach((input) => {
      input.value = data.settings[input.dataset.setting] ?? "";
      input.oninput = () => { data.settings[input.dataset.setting] = input.value; changed(); };
    });
  }

  function renderAll() {
    renderGroups();
    renderWeek();
    renderPasses();
    renderCoaches();
    renderSettings();
  }

  /* ---------- saving ---------- */
  const isDirty = () => JSON.stringify(data) !== saved;
  function setStatus(kind, text) {
    const status = $("#status");
    status.className = "status" + (kind ? ` status--${kind}` : "");
    status.textContent = text || (isDirty() ? "Есть несохранённые изменения" : "Все изменения сохранены");
  }
  function changed() { setStatus(isDirty() ? "dirty" : null); }

  function validate() {
    if (!data.groups.length) return "Нужна хотя бы одна группа.";
    const names = new Set();
    for (const g of data.groups) {
      if (!g.name.trim()) return "У одной из групп нет названия.";
      if (names.has(g.name)) return `Две группы называются «${g.name}» — переименуйте одну.`;
      names.add(g.name);
      if (g.from === "" || g.price === "" || g.length === "") return `У группы «${g.name}» не заполнены возраст, цена или длительность.`;
      if (g.to !== null && g.to < g.from) return `У группы «${g.name}» возраст «до» меньше, чем «от».`;
    }
    if (!data.passes.length) return "Нужен хотя бы один абонемент.";
    if (data.passes.some((p) => !p.name.trim())) return "У одного из абонементов нет названия.";
    if (data.coaches.some((c) => !c.name.trim())) return "У одного из тренеров не заполнено имя.";
    return "";
  }

  $("#save").addEventListener("click", async () => {
    const problem = validate();
    if (problem) { setStatus("error", problem); return; }
    const btn = $("#save");
    btn.disabled = true;
    setStatus(null, "Сохраняю…");
    try {
      if (demo) {
        try { localStorage.setItem("tetsu-demo", JSON.stringify(data)); } catch (e) { /* ignore */ }
        await new Promise((r) => setTimeout(r, 500));
      } else {
        const json = await post({ action: "save", password, data });
        data = json.data;
        normalize();
        renderAll();
      }
      saved = JSON.stringify(data);
      setStatus("ok", demo ? "Сохранено в демо — на сайте не изменится" : API_URL.includes("script.google") ? "Сохранено. Сайт обновится в течение минуты" : "Сохранено, на сайте уже новые данные");
    } catch (err) {
      setStatus("error", err.message === "Failed to fetch" ? "Нет связи. Изменения не сохранены — попробуйте ещё раз." : err.message);
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (data && isDirty()) { e.preventDefault(); e.returnValue = ""; }
  });
})();
