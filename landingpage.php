<?php
session_start();

// Check if user is logged in
if (!isset($_SESSION['teacher_id'])) {
    header("Location: login_edulock.php");
    exit();
}
?>

<!DOCTYPE html> 
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home</title>
    <style>
        @import url('https://fonts.googleapis.com/css?family=Poppins:400,700,900');

        header {
    background-color: #595168;
    padding: 0; 
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    color: white;
    text-decoration: none;
    margin: 0;
}

.usingcp {
    height: auto;
    width: 75%;
    margin-top: 10px;
    margin-left: -32%;
    position: fixed;
}

nav {
    margin: 0;
    text-align: left;
    display: flex;
    align-items: center; 
    height: 60px; 
}

nav a {
    color: white;
    text-decoration: none;
    padding: 15px 20px;
    height: auto; 
    display: flex; 
    align-items: center; 
}

nav h2 {
    color: white;
    font-size: 30px;
    margin-top: 1.8%;
    margin-right: 13%;
}

body {
    margin: 0; 
    padding: 0; 
    font-family: Poppins;
    color: #000000;
    background-color: hsla(256, 8%, 25%, 1);
    background-image: radial-gradient(circle at 100% 100%, hsla(260, 12%, 36%, 1) 0%, transparent 50%),
                      radial-gradient(circle at 0% 0%, hsla(260, 12%, 36%, 1) 0%, transparent 50%);
    background-repeat: no-repeat;
    background-attachment: fixed;
    background-size: 100% 100%;
    min-height: 100vh;
    text-align: center;
}
    
    nav a:hover {
        background-color: #807792;
    }

    h1 {
        color: white;
        font-size: 101px;
        margin-top: -10%;
        text-align: left;
        margin-left: 40px;
        z-index: 1;
    }

    h2 {
        color: white;
        font-size: 105px;
        margin-top: 5.5%;
        text-align: left;
        margin-left: 40px;
        z-index: 1;
    }


    p {
        color: white;
        margin-top: -5.5%;
        font-size: 17px;
        text-align: left;
        margin-left: 40px;
        line-height: 23px;
        z-index: 1;
        font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif;
    }



button a {
    text-decoration: none;
    color: white;
}

.button {
  margin-left: 38px;
  position: relative;
  transition: all 0.3s ease-in-out;
  box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.2);
  padding-block: 0.7rem;
  padding-inline: 2rem;
  background-color: #595168;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ffff;
  gap: 10px;
  font-weight: bold;
  outline: none;
  border: none;
  overflow: hidden;
  font-size: 15px;
  text-decoration: none;
}

.icon {
  width: 24px;
  height: 24px;
  transition: all 0.3s ease-in-out;
}

.button:hover {
  transform: scale(1.05);
  border-color: #fff9;
}

.button:hover .icon {
  transform: translate(4px);
}

.button:hover::before {
  animation: shine 1.5s ease-out infinite;
}

.button::before {
  content: "";
  position: absolute;
  width: 100px;
  height: 100%;
  background-image: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.8),
    rgba(255, 255, 255, 0) 70%
  );
  top: 0;
  left: -100px;
  opacity: 0.6;
}

.button1 {
  margin-left: 12.3%;
  margin-top: -2.7%;
  position: relative;
  transition: all 0.3s ease-in-out;
  box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.2);
  padding-block: 0.7rem;
  padding-inline: 2rem;
  background-color: #595168;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ffff;
  gap: 10px;
  font-weight: bold;
  border: none;
  outline: none;
  overflow: hidden;
  font-size: 15px;
  text-decoration: none;
}

.button1:hover {
  transform: scale(1.05);
  border-color: #fff9;
}

.button1:hover .icon {
  transform: translate(4px);
}

.button1:hover::before {
  animation: shine 1.5s ease-out infinite;
}

.button1::before {
  content: "";
  position: absolute;
  width: 100px;
  height: 100%;
  background-image: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.8),
    rgba(255, 255, 255, 0) 70%
  );
  top: 0;
  left: -100px;
  opacity: 0.6;
}

@keyframes shine {
  0% {
    left: -100px;
  }

  60% {
    left: 100%;
  }

  to {
    left: 100%;
  }
}

.lhsedulock {
    height: 50px;
    position: absolute;
    left: 15px;
    top: 6px;
}

.content {
  margin-top: 100px;
}

    </style>
</head>
<header>
    <nav>
        <h2> . </h2>
        <img src="lhsedulock1.png" alt="lhs_edulock" class="lhsedulock">
        <a href="landingpage.php">Home</a>

        <a href="logout.php">Log Out</a>
    </nav>
</header>
<body> 
    <img src="using_cp.png" alt="usingcp" class="usingcp">
    <h2> Welcome to </h2>
    <div class="content">
        <h1> Edulock </h1>
        <p> Take control of classroom focus with EduLock. This <br> powerful tool allows teachers to restrict app usage on students <br> devices during class, ensuring a distraction-free learning environment.</p>
</div>
<button class="button"> <a href="web_edulock.php"> Let's Go </a> </button
    Apply Now
    <svg fill="currentColor" viewBox="0 0 24 24" class="icon">
      <path
        clip-rule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
        fill-rule="evenodd"
      ></path>
    </svg>
  </button>
</html>