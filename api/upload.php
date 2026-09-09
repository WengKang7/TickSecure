<?php
// api/upload.php
// A simple local file uploader that replaces Firebase Storage for development

header('Content-Type: application/json');

// Ensure the uploads directory exists
$uploadDir = __DIR__ . '/../uploads/';
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];
    
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'File upload error code: ' . $file['error']]);
        exit;
    }
    
    // Sanitize filename and create a unique name
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('img_') . '_' . time() . '.' . $ext;
    $targetPath = $uploadDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        // Return the relative URL so it works anywhere
        $url = '/ticksecure-ui/uploads/' . $filename;
        echo json_encode(['url' => $url]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to move uploaded file.']);
        exit;
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded.']);
    exit;
}
?>
