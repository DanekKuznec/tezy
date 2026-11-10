/**
 * Бэкенд админки сайта клуба: читает и сохраняет данные в этой Google Таблице.
 *
 * Установка (один раз):
 *   1. Таблица → Расширения → Apps Script, вставить этот код вместо пустого.
 *   2. Поменять PASSWORD ниже на свой пароль от админки.
 *   3. Развернуть → Новое развертывание → тип «Веб-приложение»,
 *      «Выполнять как: я», «Доступ: все» → Развернуть, разрешить доступ.
 *   4. Скопировать адрес веб-приложения (…/exec) и вписать его в API_URL на сайте и в админке.
 */

const PASSWORD = 'смените-этот-пароль';

const SHEET = { groups: 'Группы', schedule: 'Расписание', settings: 'Настройки' };
const DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const SETTINGS = [
  ['single', 'Разовое занятие, ₽'],
  ['discount', 'Скидка второму ребёнку, %'],
  ['phone', 'Телефон'],
  ['address', 'Адрес'],
  ['hours', 'Часы работы'],
];

function doGet() {
  return json({ ok: true, data: readAll() });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'Некорректный запрос' });
  }

  if (body.password !== PASSWORD) {
    Utilities.sleep(1500); // slows down password guessing
    return json({ ok: false, error: 'Неверный пароль' });
  }
  if (body.action === 'check') return json({ ok: true });
  if (body.action !== 'save') return json({ ok: false, error: 'Неизвестное действие' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    writeAll(body.data || {});
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
  return json({ ok: true, data: readAll() });
}

function readAll() {
  const ss = SpreadsheetApp.getActive();
  const rows = (name) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getDisplayValues()
      .filter((r) => r.some((c) => String(c).trim() !== ''));
  };

  const groups = rows(SHEET.groups).map(([name, from, to, price, length, text]) => ({
    name: String(name).trim(),
    from: Number(from),
    to: to === '' ? null : Number(to),
    price: Number(String(price).replace(/\s/g, '')),
    length: Number(length) || 60,
    text: String(text || ''),
  })).filter((g) => g.name);

  const schedule = rows(SHEET.schedule).map(([group, day, time]) => ({
    group: String(group).trim(),
    day: String(day).trim().toLowerCase().slice(0, 2),
    time: String(time).trim().slice(0, 5),
  })).filter((s) => s.group && DAYS.includes(s.day));

  const settings = {};
  rows(SHEET.settings).forEach(([label, value]) => {
    const found = SETTINGS.find(([, title]) => String(label).trim().toLowerCase() === title.toLowerCase());
    if (found) settings[found[0]] = String(value);
  });

  return { groups, schedule, settings };
}

function writeAll(data) {
  const ss = SpreadsheetApp.getActive();
  const groups = (data.groups || []).filter((g) => g && String(g.name || '').trim());
  if (!groups.length) throw new Error('Нужна хотя бы одна группа');

  const names = new Set(groups.map((g) => String(g.name).trim()));
  const schedule = (data.schedule || []).filter((s) =>
    s && names.has(String(s.group).trim()) && DAYS.includes(s.day) && /^\d{2}:\d{2}$/.test(s.time));

  replaceRows(ss.getSheetByName(SHEET.groups), groups.map((g) => [
    String(g.name).trim(), Number(g.from) || 0, g.to === null || g.to === '' ? '' : Number(g.to),
    Number(g.price) || 0, Number(g.length) || 60, String(g.text || ''),
  ]), 6);

  const scheduleSheet = ss.getSheetByName(SHEET.schedule);
  replaceRows(scheduleSheet, schedule.map((s) => [String(s.group).trim(), s.day, s.time]), 3, true);

  const settingsSheet = ss.getSheetByName(SHEET.settings);
  const values = settingsSheet.getRange(1, 1, Math.max(settingsSheet.getLastRow(), 1), 2).getValues();
  SETTINGS.forEach(([key, title]) => {
    if (!(key in (data.settings || {}))) return;
    const i = values.findIndex(([label]) => String(label).trim().toLowerCase() === title.toLowerCase());
    if (i >= 0) settingsSheet.getRange(i + 1, 2).setValue(String(data.settings[key]));
    else settingsSheet.appendRow([title, String(data.settings[key])]);
  });
}

function replaceRows(sheet, rows, width, asText) {
  const last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, width).clearContent();
  if (!rows.length) return;
  const range = sheet.getRange(2, 1, rows.length, width);
  if (asText) range.setNumberFormat('@'); // keep "17:30" as text, not a date
  range.setValues(rows);
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
