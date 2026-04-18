<?php
session_start(); // Add session_start

//REQUIREMENTS TO THE DATABASE
$hostName = "localhost";
$dbUser = "root";
$dbPassword = "";
$dbName = "edulock_profiles";

//CONNECTING TO DATABASE 
$conn = mysqli_connect($hostName, $dbUser, $dbPassword, $dbName);

//IF THE CONNECTION FAILS TERMINATE
if (!$conn) {
    die("Something Went Wrong");
}

//THE "SUBMIT" IS A BUTTON, ONCE IT IS CLICKED, THE OTHER VARIABLES WILL BE CREATED
if (isset($_POST['submit'])) {
    //GETTING ALL THE CONNECTION TO THE HTML
    $username = $_POST['username'];
    $email = $_POST['email'];
    $password = $_POST['password'];
    $confirmPassword = $_POST['confirmPassword'];

    //IF AN STATEMENTS BELOW BECOME TRUE, THEN THE ERRORS SHOULD BE PLACE TO THE ARRAY
    $errors = array();

    //IF ANY OF THE INPUT ARE EMPTY, IT SHOULD SAY "ALL FEILDS ARE REQUIRED!"
    if (empty($username) || empty($email) || empty($password) || empty($confirmPassword)) {
        array_push($errors, "ALL FIELDS ARE REQUIRED!");
    }

    //IF THE GIVEN EMAIL IS NOT VALID  FOR EXAMPLE: NOT HAVING A SYMBOL @. WILL OUTPUT "THE EMAIL IS NOT VALID"
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        array_push($errors, "THE EMAIL IS NOT VALID");
    }

    //IF THE PASSWORD IS LESS THAN 10 CHARACTERS LONG THEN IT WILL SAY AN ERROR
    if (strlen($password) < 10) {
        array_push($errors, "THE PASSWORD MUST BE ATLEAST 10 CHARACTERS LONG!");
    }

    //IF THE PASSWORD AND THE CONFIRMPASSWORD DOES NOT MATCH GIVES AN ERROR MESSAGE
    if ($password != $confirmPassword) {
        array_push($errors, "THE PASSWORD DOES NOT MATCH");
    }
    
    //VARIABLE THAT WILL SELECT A COLUMN IN YOUR DATA TABLE; IN THIS CASE IT IS THE 'email' column and we are comparing it '$email'          
    $sql = "SELECT * FROM users WHERE gmail = '$email' ";
    
    //Execute the query
    $result = mysqli_query($conn, $sql);

    //IT CHECKS EVERY COLUMN OF THE 'email' COLUMN
    $rowCount = mysqli_num_rows($result);

    if ($rowCount) {
        array_push($errors, "EMAIL ALREADY EXISTS!");
    }

    if (count($errors) > 0) {
        foreach($errors as $error) {
            echo "<div class='alert alert-danger'>$error</div>";
        }
    } else {
        // Hash the password before storing
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        
        $sql = "INSERT INTO users (username, gmail, password) VALUES (?, ?, ?)";
        $stmt = mysqli_stmt_init($conn);
        $prepareStmt = mysqli_stmt_prepare($stmt, $sql);
        if ($prepareStmt) {
            mysqli_stmt_bind_param($stmt, "sss", $username, $email, $hashedPassword);
            mysqli_stmt_execute($stmt);
            echo "<div class='alert alert-success'>Account created successfully.</div>";
            header('Location: login_edulock.php');
            exit();
        } else {
            echo "<div class='alert alert-danger'>SOMETHING WENT WRONG</div>";
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign Up</title>
    <link rel="shortcut icon" type="x-icon" href="rework_edulock.jpg">
    <link rel="stylesheet" href="sign_up_edulock.css">
</head>
<body>
<img src="lhs_edulock.png" alt="lhs_edulock" class="lhsedulock">
<div class="container">
    <div class="input_form_right">
        <form action="sign_up_edulock.php" method="post">
            <h5>Get Started!</h5>
            <h2>Create your account</h2>

            <form class="form">
                <div class="flex-column">
                    <label>Username </label>
                </div>
                <div class="inputForm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    <input placeholder="Enter your Username" class="input" type="text" name="username">
                </div>

                <div class="flex-column">
                    <label>Email </label>
                </div>
                <div class="inputForm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="0 0 32 32" height="20"><g data-name="Layer 3" id="Layer_3"><path d="m30.853 13.87a15 15 0 0 0 -29.729 4.082 15.1 15.1 0 0 0 12.876 12.918 15.6 15.6 0 0 0 2.016.13 14.85 14.85 0 0 0 7.715-2.145 1 1 0 1 0 -1.031-1.711 13.007 13.007 0 1 1 5.458-6.529 2.149 2.149 0 0 1 -4.158-.759v-10.856a1 1 0 0 0 -2 0v1.726a8 8 0 1 0 .2 10.325 4.135 4.135 0 0 0 7.83.274 15.2 15.2 0 0 0 .823-7.455zm-14.853 8.13a6 6 0 1 1 6-6 6.006 6.006 0 0 1 -6 6z"></path></g></svg>
                    <input placeholder="Enter your Email" class="input" type="email" name="email">
                </div>

                <div class="flex-column">
                    <label>Password </label>
                </div>
                <div class="inputForm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="-64 0 512 512" height="20"><path d="m336 512h-288c-26.453125 0-48-21.523438-48-48v-224c0-26.476562 21.546875-48 48-48h288c26.453125 0 48 21.523438 48 48v224c0 26.476562-21.546875 48-48 48zm-288-288c-8.8125 0-16 7.167969-16 16v224c0 8.832031 7.1875 16 16 16h288c8.8125 0 16-7.167969 16-16v-224c0-8.832031-7.1875-16-16-16zm0 0"></path><path d="m304 224c-8.832031 0-16-7.167969-16-16v-80c0-52.929688-43.070312-96-96-96s-96 43.070312-96 96v80c0 8.832031-7.167969 16-16 16s-16-7.167969-16-16v-80c0-70.59375 57.40625-128 128-128s128 57.40625 128 128v80c0 8.832031-7.167969 16-16 16zm0 0"></path></svg>
                    <input placeholder="Enter your Password" class="input" type="password" name="password">
                </div>

                <div class="flex-column">
                    <label>Confirm Password </label>
                </div>
                <div class="inputForm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="-64 0 512 512" height="20"><path d="m336 512h-288c-26.453125 0-48-21.523438-48-48v-224c0-26.476562 21.546875-48 48-48h288c26.453125 0 48 21.523438 48 48v224c0 26.476562-21.546875 48-48 48zm-288-288c-8.8125 0-16 7.167969-16 16v224c0 8.832031 7.1875 16 16 16h288c8.8125 0 16-7.167969 16-16v-224c0-8.832031-7.1875-16-16-16zm0 0"></path><path d="m304 224c-8.832031 0-16-7.167969-16-16v-80c0-52.929688-43.070312-96-96-96s-96 43.070312-96 96v80c0 8.832031-7.167969 16-16 16s-16-7.167969-16-16v-80c0-70.59375 57.40625-128 128-128s128 57.40625 128 128v80c0 8.832031-7.167969 16-16 16zm0 0"></path></svg>
                    <input placeholder="Confirm your Password" class="input" type="password" name="confirmPassword">
                </div>

                <button type="submit" name="submit">Sign Up
                    <div class="arrow-wrapper">
                        <div class="arrow">
                        </div>
                    </div>
                </button>
                <p class="p">Already have an account? <a href="login_edulock.php"><span class="span">Login</span></a></p>
            </form>
        </form>
    </div>
    <div class="side_design">
        <img src="marble.png" alt="side_design" class="side_design_img_left">
    </div>
</div>
</body>
</html>