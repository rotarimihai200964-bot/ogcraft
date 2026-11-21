<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = array_filter(array_map('trim', explode(',', getenv('ALLOWED_ORIGINS') ?: '*')));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($allowedOrigins === [] || in_array('*', $allowedOrigins, true) || ($origin !== '' && in_array($origin, $allowedOrigins, true))) {
    header('Access-Control-Allow-Origin: ' . ($origin !== '' ? $origin : '*'));
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function reply(int $status, array $payload): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function loadEnvFile(string $path): void {
    if (!is_file($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (!getenv($key)) putenv($key . '=' . trim($value, "\"'"));
    }
}

loadEnvFile(__DIR__ . '/.env');

$required = ['DB_HOST', 'DB_NAME', 'DB_USER'];
foreach ($required as $key) {
    if (!getenv($key)) reply(500, ['error' => 'database_not_configured']);
}

$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    getenv('DB_HOST'),
    getenv('DB_PORT') ?: '3306',
    getenv('DB_NAME')
);

try {
    $pdo = new PDO($dsn, getenv('DB_USER'), getenv('DB_PASS') ?: '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
} catch (Throwable $error) {
    reply(500, ['error' => 'database_connection_failed']);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $category = preg_replace('/[^a-z]/', '', (string) ($_GET['category'] ?? ''));
    $allowedCategories = ['announcements', 'factions', 'events', 'help'];
    $params = [];
    $sql = 'SELECT id, category, severity, message, author, `rank`, images, created_at
            FROM ogcraft_chat_messages';
    if (in_array($category, $allowedCategories, true)) {
        $sql .= ' WHERE category = ?';
        $params[] = $category;
    }
    $sql .= ' ORDER BY created_at DESC, id DESC LIMIT 100';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $messages = $statement->fetchAll();
    foreach ($messages as &$message) {
        $message['images'] = $message['images'] ? json_decode((string) $message['images'], true) : [];
        $message['createdAt'] = $message['created_at'];
        unset($message['created_at']);
    }
    reply(200, ['messages' => array_reverse($messages)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(405, ['error' => 'method_not_allowed']);
}

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body)) reply(400, ['error' => 'invalid_json']);

$category = (string) ($body['category'] ?? '');
$severity = (string) ($body['severity'] ?? '');
$message = trim((string) ($body['message'] ?? ''));
$author = trim((string) ($body['author'] ?? ''));
$rank = trim((string) ($body['rank'] ?? 'Jucător'));
$images = is_array($body['images'] ?? null) ? $body['images'] : [];
$allowedCategories = ['announcements', 'factions', 'events', 'help'];
$allowedSeverities = ['info', 'normal', 'important', 'urgent'];

if (!in_array($category, $allowedCategories, true)) reply(400, ['error' => 'invalid_category']);
if (!in_array($severity, $allowedSeverities, true)) reply(400, ['error' => 'invalid_severity']);
if (mb_strlen($message) < 1 || mb_strlen($message) > 2000) reply(400, ['error' => 'invalid_message']);
if (!preg_match('/^[A-Za-z0-9_]{3,16}$/', $author)) reply(400, ['error' => 'invalid_author']);
if (mb_strlen($rank) > 24) reply(400, ['error' => 'invalid_rank']);
if (count($images) > 3) reply(400, ['error' => 'too_many_images']);

$validImages = [];
foreach ($images as $image) {
    if (!is_string($image) || !preg_match('/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+\/=]+$/', $image)) {
        reply(400, ['error' => 'invalid_image']);
    }
    if (strlen($image) > 400 * 1024) reply(400, ['error' => 'image_too_large']);
    $validImages[] = $image;
}

$bytes = random_bytes(16);
$id = sprintf(
    '%s-%s-%s-%s-%s',
    bin2hex(substr($bytes, 0, 4)),
    bin2hex(substr($bytes, 4, 2)),
    bin2hex(substr($bytes, 6, 2)),
    bin2hex(substr($bytes, 8, 2)),
    bin2hex(substr($bytes, 10, 6))
);

$statement = $pdo->prepare(
    'INSERT INTO ogcraft_chat_messages (id, category, severity, message, author, `rank`, images)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
);
$statement->execute([$id, $category, $severity, $message, $author, $rank, $validImages ? json_encode($validImages, JSON_UNESCAPED_SLASHES) : null]);

reply(201, [
    'message' => [
        'id' => $id,
        'category' => $category,
        'severity' => $severity,
        'message' => $message,
        'author' => $author,
        'rank' => $rank,
        'images' => $validImages,
        'createdAt' => gmdate('Y-m-d\TH:i:s\Z')
    ]
]);
