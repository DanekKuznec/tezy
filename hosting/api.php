<?php
/**
 * Backend of the club admin for an ordinary PHP hosting (no Google, no database).
 * GET  -> {"ok":true,"data":{...}}      read by the site and the admin
 * POST -> {"action":"check"|"save", "password":"...", "data":{...}}
 * Data lives in data.json next to this file; every save keeps a copy in backups/.
 * Works on PHP 7.4+.
 */

require __DIR__ . '/config.php';

const DATA_FILE = __DIR__ . '/data.json';
const BACKUP_DIR = __DIR__ . '/backups';
const KEEP_BACKUPS = 30;
const DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const SETTINGS = ['discount', 'phone', 'address', 'hours'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    reply(['ok' => true, 'data' => readData()]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    reply(['ok' => false, 'error' => 'Некорректный запрос'], 400);
}

if (tooManyAttempts()) {
    reply(['ok' => false, 'error' => 'Слишком много попыток. Подождите 10 минут.'], 429);
}
if (!passwordMatches((string)($body['password'] ?? ''))) {
    noteFailedAttempt();
    sleep(2); // slows down password guessing
    reply(['ok' => false, 'error' => 'Неверный пароль'], 403);
}

$action = $body['action'] ?? '';
if ($action === 'check') {
    reply(['ok' => true]);
}
if ($action !== 'save') {
    reply(['ok' => false, 'error' => 'Неизвестное действие'], 400);
}

try {
    $clean = cleanData(is_array($body['data'] ?? null) ? $body['data'] : []);
    writeData($clean);
} catch (Throwable $e) {
    reply(['ok' => false, 'error' => $e->getMessage()], 400);
}
reply(['ok' => true, 'data' => readData()]);


function reply(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function readData(): array
{
    if (!is_file(DATA_FILE)) {
        return ['groups' => [], 'schedule' => [], 'settings' => new stdClass(), 'passes' => [], 'coaches' => []];
    }
    $data = json_decode((string)file_get_contents(DATA_FILE), true);
    return is_array($data) ? $data : [];
}

function writeData(array $data): void
{
    if (!is_dir(BACKUP_DIR) && !mkdir(BACKUP_DIR, 0755, true)) {
        throw new RuntimeException('Не удалось создать папку backups — проверьте права на папку сайта');
    }
    $lock = fopen(DATA_FILE . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Не удалось сохранить, попробуйте ещё раз');
    }
    try {
        if (is_file(DATA_FILE)) {
            copy(DATA_FILE, BACKUP_DIR . '/data-' . date('Y-m-d_H-i-s') . '.json');
            $old = glob(BACKUP_DIR . '/data-*.json');
            sort($old);
            foreach (array_slice($old, 0, max(0, count($old) - KEEP_BACKUPS)) as $file) {
                unlink($file);
            }
        }
        // write to a temp file first, so a failed write never leaves half a file
        $tmp = DATA_FILE . '.tmp';
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if (file_put_contents($tmp, $json) === false || !rename($tmp, DATA_FILE)) {
            throw new RuntimeException('Не удалось записать данные — проверьте права на папку сайта');
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function text($value, int $max): string
{
    $value = trim(str_replace(["\r\n", "\r"], "\n", (string)$value));
    return function_exists('mb_substr') ? mb_substr($value, 0, $max) : $value;
}

function number($value): int
{
    return (int)preg_replace('/\D/', '', (string)$value);
}

function cleanData(array $in): array
{
    $groups = [];
    $names = [];
    foreach ((array)($in['groups'] ?? []) as $g) {
        $name = text($g['name'] ?? '', 40);
        if ($name === '' || isset($names[$name])) {
            continue;
        }
        $names[$name] = true;
        $to = $g['to'] ?? null;
        $groups[] = [
            'name' => $name,
            'from' => number($g['from'] ?? 0),
            'to' => ($to === null || $to === '') ? null : number($to),
            'price' => number($g['price'] ?? 0),
            'length' => number($g['length'] ?? 60) ?: 60,
            'text' => text($g['text'] ?? '', 300),
        ];
    }
    if (!$groups) {
        throw new RuntimeException('Нужна хотя бы одна группа');
    }

    $schedule = [];
    foreach ((array)($in['schedule'] ?? []) as $s) {
        $group = text($s['group'] ?? '', 40);
        $day = (string)($s['day'] ?? '');
        $time = (string)($s['time'] ?? '');
        if (isset($names[$group]) && in_array($day, DAYS, true) && preg_match('/^\d{2}:\d{2}$/', $time)) {
            $schedule[] = ['group' => $group, 'day' => $day, 'time' => $time];
        }
    }

    $settings = [];
    foreach (SETTINGS as $key) {
        if (isset($in['settings'][$key])) {
            $settings[$key] = text($in['settings'][$key], 200);
        }
    }

    $passes = [];
    foreach ((array)($in['passes'] ?? []) as $p) {
        $name = text($p['name'] ?? '', 30);
        if ($name !== '') {
            $passes[] = ['name' => $name, 'price' => text($p['price'] ?? '', 20), 'note' => text($p['note'] ?? '', 200), 'main' => !empty($p['main'])];
        }
    }

    $coaches = [];
    foreach ((array)($in['coaches'] ?? []) as $c) {
        $name = text($c['name'] ?? '', 40);
        if ($name !== '') {
            $coaches[] = ['name' => $name, 'rank' => text($c['rank'] ?? '', 50), 'text' => text($c['text'] ?? '', 300)];
        }
    }

    return ['groups' => $groups, 'schedule' => $schedule, 'settings' => (object)$settings, 'passes' => $passes, 'coaches' => $coaches];
}

function passwordMatches(string $given): bool
{
    if ($given === '' || ADMIN_PASSWORD === '' || ADMIN_PASSWORD === 'смените-этот-пароль') {
        return false;
    }
    // config may hold either a password_hash() result or the password itself
    if (strpos(ADMIN_PASSWORD, '$2y$') === 0) {
        return password_verify($given, ADMIN_PASSWORD);
    }
    return hash_equals(ADMIN_PASSWORD, $given);
}

// Failed logins per visitor address, kept in the system temp folder (not in the site folder).
function attemptsFile(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return sys_get_temp_dir() . '/club-admin-' . md5(__DIR__ . $ip);
}

function tooManyAttempts(): bool
{
    $file = attemptsFile();
    if (!is_file($file)) {
        return false;
    }
    if (filemtime($file) < time() - 600) {
        @unlink($file);
        return false;
    }
    return (int)file_get_contents($file) >= 10;
}

function noteFailedAttempt(): void
{
    $file = attemptsFile();
    $count = is_file($file) ? (int)file_get_contents($file) : 0;
    @file_put_contents($file, (string)($count + 1));
}
