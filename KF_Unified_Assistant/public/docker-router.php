<?php
declare(strict_types=1);

// Only the web bundle and the existing Compose artwork volume may be served.
// Resolve links before handing the request back to PHP's static file server.
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($path) ? rawurldecode($path) : '';
if (str_starts_with($path, '/') && !str_contains($path, '\\') && !preg_match('~(?:/\.)|[\x00-\x1f\x7f]~', $path)) {
    $artwork = str_starts_with($path, '/assets/');
    $root = $artwork ? realpath(dirname(__DIR__) . '/assets') : realpath(__DIR__);
    $file = realpath(__DIR__ . $path);
    if (!$artwork && $file !== false && is_dir($file)) {
        $path = rtrim($path, '/') . '/index.html';
        $file = realpath($file . '/index.html');
    }

    if ($root !== false && $file !== false && is_file($file) && str_starts_with($file, $root . DIRECTORY_SEPARATOR)) {
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file, strlen($root)));
        $image = '~\.(?:png|jpe?g|jfif|gif|webp|avif|bmp|ico|svg|tiff?|hei[cf])$~iD';
        if ($artwork && !str_contains($relative, '/.') && preg_match($image, $path) && preg_match($image, $relative)) return false;
        if (!$artwork && !str_contains($relative, '/.')) {
            if ($path === '/api.php' && $relative === '/api.php') return false;
            $webFile = '~\.(?:html|js|css|json|txt|webp)$~iD';
            if (preg_match($webFile, $path) && preg_match($webFile, $relative)) return false;
        }
    }
}

http_response_code(404);
return true;
