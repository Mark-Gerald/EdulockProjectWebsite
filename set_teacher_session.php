<?php
session_start();

// This file handles setting the PHP session after Firebase authentication

if (isset($_POST['teacher_id']) && isset($_POST['email'])) {
    $_SESSION['teacher_id'] = $_POST['teacher_id'];
    $_SESSION['email'] = $_POST['email'];
    $_SESSION['display_name'] = $_POST['display_name'] ?? $_POST['email'];
    
    // Return success
    echo "success";
} else {
    // Return error
    http_response_code(400);
    echo "error: missing required parameters";
}
?>