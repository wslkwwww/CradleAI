<?php
/**
 * Cradle Cloud Service - PHP Fallback Proxy
 * 
 * This script serves as a fallback for forwarding API requests to
 * Gemini and OpenRouter when Nginx configuration cannot be modified.
 * It properly handles URL parsing to avoid double-encoding issues.
 */

// Enable error reporting for debugging
ini_set('display_errors', 0);
error_log("Cradle proxy request started");

// Check for duplicate chat path in URI
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
if (preg_match('#^/chat/chat(.*)$#', $requestUri, $matches)) {
    error_log("检测到重复的 /chat 路径段，重定向到: /chat" . $matches[1]);
    header("Location: /chat" . $matches[1], true, 301);
    exit;
}

// CORS headers to allow requests from the app
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-License-Key, X-Device-ID, X-Provider, Authorization');

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('HTTP/1.1 204 No Content');
    exit;
}

// Required headers
$requiredHeaders = ['X-License-Key', 'X-Device-ID', 'X-Provider'];
foreach ($requiredHeaders as $header) {
    if (!isset($_SERVER['HTTP_' . str_replace('-', '_', $header)])) {
        http_response_code(403);
        echo json_encode(['error' => "Missing required header: $header"]);
        exit;
    }
}

// Get license info from headers
$licenseKey = $_SERVER['HTTP_X_LICENSE_KEY'];
$deviceId = $_SERVER['HTTP_X_DEVICE_ID'];
$provider = strtolower($_SERVER['HTTP_X_PROVIDER']);

/**
 * Mask API keys in URLs and other strings for logging
 */
function maskApiKey($str) {
    // Mask "key=XXX" parameters
    $masked = preg_replace('/(\bkey=)([^&]{4})[^&]*/i', '$1$2****', $str);
    
    // Mask "Bearer XXX" in headers
    $masked = preg_replace('/(\bBearer\s+)([^\s]{4})[^\s]*/i', '$1$2****', $masked);
    
    // Mask API key if it appears in other formats (long alphanumeric strings)
    $masked = preg_replace_callback('/([A-Za-z0-9_-]{20,})/', function($matches) {
        // Only mask if it looks like an API key
        if (strlen($matches[0]) >= 20 && preg_match('/^[A-Za-z0-9_-]+$/', $matches[0])) {
            return substr($matches[0], 0, 4) . '****';
        }
        return $matches[0];
    }, $masked);
    
    return $masked;
}

// Get endpoint parameter and perform validation
if (!isset($_GET['endpoint'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing endpoint parameter']);
    exit;
}

// Get endpoint parameter and mask API key for logging
$endpoint = $_GET['endpoint'];
$maskedEndpoint = maskApiKey($endpoint);
error_log("Raw endpoint parameter (masked): " . $maskedEndpoint);

// Use the endpoint directly as the target URL
$targetUrl = $endpoint;
error_log("Target URL (masked): " . $maskedEndpoint);

// Get request body
$requestBody = file_get_contents('php://input');
error_log("Request body length: " . strlen($requestBody));

// Mask any API keys in the request body preview
$bodyPreview = substr($requestBody, 0, 100) . (strlen($requestBody) > 100 ? '...' : '');
$maskedBodyPreview = maskApiKey($bodyPreview);
error_log("Request body preview (masked): " . $maskedBodyPreview);

// Set up cURL request
$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 120);

// Set request method
$method = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

// Determine the correct host header based on provider
$host = '';
if ($provider === 'gemini') {
    $host = 'generativelanguage.googleapis.com';
} elseif ($provider === 'openrouter') {
    $host = 'openrouter.ai';
} else {
    // Extract host from URL as fallback
    $urlParts = parse_url($targetUrl);
    $host = $urlParts['host'] ?? '';
}

error_log("Setting host header to: " . $host);

// Transfer headers from original request, except for our custom ones
$headers = [];
foreach ($_SERVER as $key => $value) {
    if (strpos($key, 'HTTP_') === 0) {
        $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
        // Skip our custom headers
        if (!in_array($header, ['X-License-Key', 'X-Device-Id', 'X-Provider'])) {
            // Mask Authorization header for logging
            if ($header === 'Authorization') {
                error_log("Header: $header: " . maskApiKey($value));
                $headers[] = "$header: $value";
            } else {
                error_log("Header: $header: $value");
                $headers[] = "$header: $value";
            }
        }
    }
}

// Override the Host header with the target host
$headers[] = "Host: $host";

// Set content type if present
if (isset($_SERVER['CONTENT_TYPE'])) {
    $headers[] = "Content-Type: " . $_SERVER['CONTENT_TYPE'];
}

// Set request body if not empty
if (!empty($requestBody)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
}

// Set request headers
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Execute the request
error_log("Sending request to target URL with host header: $host");
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$error = curl_error($ch);
$errorNo = curl_errno($ch);

if ($errorNo > 0) {
    error_log("cURL error ($errorNo): $error");
    http_response_code(502);
    echo json_encode(['error' => "Proxy error: $error"]);
    curl_close($ch);
    exit;
}

curl_close($ch);

// Set response headers
if ($contentType) {
    header("Content-Type: $contentType");
}
http_response_code($httpCode);

// Output the response
echo $response;
error_log("Request completed with status code: $httpCode");
?>
