<?php
session_start();

// Check if user is already logged in
if (isset($_SESSION['teacher_id'])) {
    header("Location: landingpage.php");
    exit();
}

$loginError = "";

// We'll handle login via JavaScript with Firebase
if (isset($_POST['submit'])) {
    // We'll just set a flag to trigger the JavaScript login
    $attemptLogin = true;
} else {
    $attemptLogin = false;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teacher Login - EduLock</title>
    <link rel="shortcut icon" type="x-icon" href="rework_edulock.jpg">
    <link rel="stylesheet" href="login_edulock_style.css">
    
    <!-- Firebase SDK -->
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-database-compat.js"></script>
</head>
<body>
<img src="lhs_edulock.png" alt="lhs_edulock" class="lhsedulock">
<div class="container">
    <div class="input">
            
    <div class="input_form">
        <form id="loginForm" method="post">
            <h5>Teacher Access Only</h5>
            <h2>Login to Edulock</h2>

            <div id="loginError" class="alert alert-danger" style="display: none; color: #e74c3c; background-color: #fadbd8; padding: 10px; border-radius: 5px; margin-bottom: 15px;"></div>

            <div class="flex-column">
                <label>Email </label>
            </div>
            <div class="inputForm">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="0 0 32 32" height="20"><g data-name="Layer 3" id="Layer_3"><path d="m30.853 13.87a15 15 0 0 0 -29.729 4.082 15.1 15.1 0 0 0 12.876 12.918 15.6 15.6 0 0 0 2.016.13 14.85 14.85 0 0 0 7.715-2.145 1 1 0 1 0 -1.031-1.711 13.007 13.007 0 1 1 5.458-6.529 2.149 2.149 0 0 1 -4.158-.759v-10.856a1 1 0 0 0 -2 0v1.726a8 8 0 1 0 .2 10.325 4.135 4.135 0 0 0 7.83.274 15.2 15.2 0 0 0 .823-7.455zm-14.853 8.13a6 6 0 1 1 6-6 6.006 6.006 0 0 1 -6 6z"></path></g></svg>
                <input placeholder="Enter your Email" class="input" type="email" name="email" id="email" required>
            </div>
        
            <div class="flex-column">
                <label>Password </label>
            </div>
            <div class="inputForm">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="-64 0 512 512" height="20"><path d="m336 512h-288c-26.453125 0-48-21.523438-48-48v-224c0-26.476562 21.546875-48 48-48h288c26.453125 0 48 21.523438 48 48v224c0 26.476562-21.546875 48-48 48zm-288-288c-8.8125 0-16 7.167969-16 16v224c0 8.832031 7.1875 16 16 16h288c8.8125 0 16-7.167969 16-16v-224c0-8.832031-7.1875-16-16-16zm0 0"></path><path d="m304 224c-8.832031 0-16-7.167969-16-16v-80c0-52.929688-43.070312-96-96-96s-96 43.070312-96 96v80c0 8.832031-7.167969 16-16 16s-16-7.167969-16-16v-80c0-70.59375 57.40625-128 128-128s128 57.40625 128 128v80c0 8.832031-7.167969 16-16 16zm0 0"></path></svg>        
                <input placeholder="Enter your Password" class="input" type="password" name="password" id="password" required>
            </div>

            <button class="button-submit" type="submit" name="submit" id="loginButton">Login</button>
        </form>
    </div>
    </div>
    
    <!-- Add the right side image container back -->
    <div class="side_design_img">
        <img src="purple_fabric.png" alt="edulock_login">
    </div>
</div>

<!-- Firebase Authentication Script -->
<script>
    // Firebase configuration - use the same config as your main app
    const firebaseConfig = {
        apiKey: "AIzaSyBeHzg_OhGUKRJ6H2jP_B3m-YICNPQmFzU",
        authDomain: "edulock-register-firebase.firebaseapp.com",
        databaseURL: "https://edulock-register-firebase-default-rtdb.firebaseio.com",
        projectId: "edulock-register-firebase",
        storageBucket: "edulock-register-firebase.appspot.com",
        messagingSenderId: "1039430447528",
        appId: "1:1039430447528:web:c4f4514659a2a2c24d5e0c"
    };

    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // Get elements
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('loginError');
    const requestAccessLink = document.getElementById('requestAccessLink');

    // Handle login form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = emailInput.value;
        const password = passwordInput.value;
        
        // Show loading state
        document.getElementById('loginButton').textContent = 'Logging in...';
        document.getElementById('loginButton').disabled = true;
        
        // Sign in with Firebase
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Check if user is a teacher in the database
                const user = userCredential.user;
                
                // Reference to the teachers collection
                const teacherRef = firebase.database().ref('teachers/' + user.uid);
                
                teacherRef.once('value')
                    .then((snapshot) => {
                        if (snapshot.exists()) {
                            // User is a teacher, set session and redirect
                            // We'll use AJAX to set the PHP session
                            const xhr = new XMLHttpRequest();
                            xhr.open('POST', 'set_teacher_session.php', true);
                            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                            xhr.onload = function() {
                                if (this.status === 200) {
                                    window.location.href = 'landingpage.php';
                                } else {
                                    showError('Session error. Please try again.');
                                    resetLoginButton();
                                }
                            };
                            xhr.send('teacher_id=' + user.uid + '&email=' + encodeURIComponent(user.email) + '&display_name=' + encodeURIComponent(snapshot.val().displayName || user.email));
                        } else {
                            // Not a teacher account
                            firebase.auth().signOut();
                            showError('This account does not have teacher access.');
                            resetLoginButton();
                        }
                    })
                    .catch((error) => {
                        console.error("Database error:", error);
                        showError('Database error: ' + error.message);
                        resetLoginButton();
                    });
            })
            .catch((error) => {
                console.error("Auth error:", error);
                // Simplified error messages for users
                if (error.code === 'auth/user-not-found' || 
                    error.code === 'auth/wrong-password' || 
                    error.code === 'auth/invalid-login-credentials' || 
                    error.code === 'auth/invalid-email') {
                    showError('Invalid email or password.');
                } else if (error.code === 'auth/too-many-requests') {
                    showError('Too many failed login attempts. Please try again later.');
                } else if (error.code === 'auth/network-request-failed') {
                    showError('Network error. Please check your internet connection.');
                } else {
                    // Generic error message instead of showing technical details
                    showError('Login failed. Please try again.');
                }
                resetLoginButton();
            });
    });

    // Request access link
    requestAccessLink.addEventListener('click', function(e) {
        e.preventDefault();
        alert('Please contact the system administrator to request teacher access.');
    });

    function showError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }

    function resetLoginButton() {
        document.getElementById('loginButton').textContent = 'Login';
        document.getElementById('loginButton').disabled = false;
    }

    // Check if user is already logged in
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Check if the user is a teacher
            const teacherRef = firebase.database().ref('teachers/' + user.uid);
            teacherRef.once('value')
                .then((snapshot) => {
                    if (snapshot.exists()) {
                        // User is a teacher, set session and redirect
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', 'set_teacher_session.php', true);
                        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                        xhr.onload = function() {
                            if (this.status === 200) {
                                window.location.href = 'landingpage.php';
                            }
                        };
                        xhr.send('teacher_id=' + user.uid + '&email=' + encodeURIComponent(user.email) + '&display_name=' + encodeURIComponent(snapshot.val().displayName || user.email));
                    }
                });
        }
    });

    // Check if we're coming from logout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('logout')) {
        // Sign out from Firebase
        firebase.auth().signOut().then(() => {
            console.log('User signed out of Firebase');
        }).catch((error) => {
            console.error('Error signing out:', error);
        });
    }
</script>
</body>
</html>