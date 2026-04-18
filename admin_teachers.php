<?php
session_start();

// Check if user is logged in and is an admin
if (!isset($_SESSION['teacher_id']) || !isset($_SESSION['is_admin']) || $_SESSION['is_admin'] !== true) {
    header("Location: login_edulock.php");
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teacher Management - EduLock</title>
    <link rel="stylesheet" href="styles.css">
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-database-compat.js"></script>
    <style>
        .teacher-list {
            margin-top: 20px;
        }
        .teacher-item {
            background-color: #2d1b4e;
            color: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .teacher-info {
            flex: 1;
        }
        .teacher-actions {
            display: flex;
            gap: 10px;
        }
        .btn-edit, .btn-delete {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn-edit {
            background-color: #3498db;
            color: white;
        }
        .btn-delete {
            background-color: #e74c3c;
            color: white;
        }
        .add-teacher-form {
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: white;
        }
        .form-group input {
            width: 100%;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #8c52ff;
            background-color: #3a2a5e;
            color: white;
        }
        .btn-add {
            background-color: #2ecc71;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header-container">
                <a href="landingpage.php" class="back-button">
                    <i class="fas fa-arrow-left"></i> Back to Home
                </a>
                <h1 class="page-title">TEACHER MANAGEMENT</h1>
                <div style="width: 120px;"></div>
            </div>
            
            <div class="content-container">
                <div class="section-container">
                    <h2>Add New Teacher</h2>
                    <div class="add-teacher-form">
                        <div id="formError" class="alert alert-danger" style="display: none; color: #e74c3c; background-color: #fadbd8; padding: 10px; border-radius: 5px; margin-bottom: 15px;"></div>
                        <div id="formSuccess" class="alert alert-success" style="display: none; color: #2ecc71; background-color: #d5f5e3; padding: 10px; border-radius: 5px; margin-bottom: 15px;"></div>
                        
                        <form id="addTeacherForm">
                            <div class="form-group">
                                <label for="displayName">Teacher Name</label>
                                <input type="text" id="displayName" name="displayName" required>
                            </div>
                            <div class="form-group">
                                <label for="email">Email</label>
                                <input type="email" id="email" name="email" required>
                            </div>
                            <div class="form-group">
                                <label for="password">Password</label>
                                <input type="password" id="password" name="password" required>
                            </div>
                            <button type="submit" class="btn-add">Add Teacher</button>
                        </form>
                    </div>
                </div>
                
                <div class="section-container">
                    <h2>Teacher Accounts</h2>
                    <div id="teacherList" class="teacher-list">
                        <!-- Teacher list will be populated here -->
                        <div class="loading">Loading teachers...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyBPyX-vMxXf-Wn4Rx9jKlHUWYWYWcxqpuM",
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

        // DOM elements
        const addTeacherForm = document.getElementById('addTeacherForm');
        const teacherList = document.getElementById('teacherList');
        const formError = document.getElementById('formError');
        const formSuccess = document.getElementById('formSuccess');

        // Load teachers
        function loadTeachers() {
            const teachersRef = firebase.database().ref('teachers');
            
            teachersRef.on('value', (snapshot) => {
                teacherList.innerHTML = '';
                
                if (!snapshot.exists()) {
                    teacherList.innerHTML = '<div class="no-data">No teachers found</div>';
                    return;
                }
                
                snapshot.forEach((childSnapshot) => {
                    const teacherId = childSnapshot.key;
                    const teacher = childSnapshot.val();
                    
                    const teacherItem = document.createElement('div');
                    teacherItem.className = 'teacher-item';
                    
                    const teacherInfo = document.createElement('div');
                    teacherInfo.className = 'teacher-info';
                    
                    const teacherName = document.createElement('h3');
                    teacherName.textContent = teacher.displayName || 'No Name';
                    
                    const teacherEmail = document.createElement('p');
                    teacherEmail.textContent = teacher.email;
                    
                    teacherInfo.appendChild(teacherName);
                    teacherInfo.appendChild(teacherEmail);
                    
                    const teacherActions = document.createElement('div');
                    teacherActions.className = 'teacher-actions';
                    
                    const editButton = document.createElement('button');
                    editButton.className = 'btn-edit';
                    editButton.textContent = 'Edit';
                    editButton.addEventListener('click', () => editTeacher(teacherId, teacher));
                    
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'btn-delete';
                    deleteButton.textContent = 'Delete';
                    deleteButton.addEventListener('click', () => deleteTeacher(teacherId, teacher.email));
                    
                    teacherActions.appendChild(editButton);
                    teacherActions.appendChild(deleteButton);
                    
                    teacherItem.appendChild(teacherInfo);
                    teacherItem.appendChild(teacherActions);
                    
                    teacherList.appendChild(teacherItem);
                });
            });
        }

        // Add teacher
        addTeacherForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const displayName = document.getElementById('displayName').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Clear previous messages
            formError.style.display = 'none';
            formSuccess.style.display = 'none';
            
            // Create user in Firebase Auth
            firebase.auth().createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    
                    // Add user to teachers collection
                    return firebase.database().ref('teachers/' + user.uid).set({
                        displayName: displayName,
                        email: email,
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                })
                .then(() => {
                    // Success
                    formSuccess.textContent = 'Teacher added successfully!';
                    formSuccess.style.display = 'block';
                    
                    // Clear form
                    addTeacherForm.reset();
                    
                    // Sign out the newly created user (we were automatically signed in)
                    return firebase.auth().signOut();
                })
                .catch((error) => {
                    console.error("Error adding teacher:", error);
                    formError.textContent = 'Error: ' + error.message;
                    formError.style.display = 'block';
                });
        });

        // Edit teacher
        function editTeacher(teacherId, teacher) {
            // For simplicity, we'll just use prompt dialogs
            const newName = prompt('Enter new name:', teacher.displayName);
            if (newName === null) return; // User cancelled
            
            firebase.database().ref('teachers/' + teacherId).update({
                displayName: newName
            })
            .then(() => {
                alert('Teacher updated successfully!');
            })
            .catch((error) => {
                console.error("Error updating teacher:", error);
                alert('Error: ' + error.message);
            });
        }

        // Delete teacher
        function deleteTeacher(teacherId, email) {
            if (!confirm(`Are you sure you want to delete ${email}?`)) {
                return;
            }
            
            // Delete from database first
            firebase.database().ref('teachers/' + teacherId).remove()
                .then(() => {
                    alert('Teacher removed from database.');
                    
                    // Note: Deleting the actual Auth user requires admin SDK
                    // which can't be used in client-side code for security reasons.
                    // You would need a server-side component (Cloud Functions, etc.)
                    // to fully delete the user from Authentication.
                    alert('Note: The user account still exists in Authentication. Only an administrator can fully delete it.');
                })
                .catch((error) => {
                    console.error("Error deleting teacher:", error);
                    alert('Error: ' + error.message);
                });
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            loadTeachers();
        });
    </script>
</body>
</html>