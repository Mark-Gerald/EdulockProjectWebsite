<?php
session_start();

// Check if user is logged in
if (!isset($_SESSION['teacher_id'])) {
    header("Location: login_edulock.php");
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EduLock Controller</title>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-database-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"></script>
    <script src="https://unpkg.com/html5-qrcode"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css">
    <style>
       .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background-color: #2d1b4e;
            border-radius: 8px 8px 0 0;
            margin-bottom: 20px;
        }
        
        .back-button {
            display: flex;
            align-items: center;
            padding: 8px 15px;
            background-color: #8c52ff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            transition: all 0.3s ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .back-button i {
            margin-right: 8px;
        }
        
        .back-button:hover {
            background-color: #9d6aff;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .page-title {
            margin: 0;
            color: white;
            font-size: 1.8rem;
        }
        
        .card {
            border-radius: 10px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            overflow: hidden;
            background: linear-gradient(to bottom, #3a2a5e, #2d1b4e);
        }
        
        .section-container {
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
        }
        
        .control-buttons {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        
        .btn-block, .btn-unblock, .btn-disconnect, .btn-add-device, .btn-stop-scanning {
            padding: 12px 20px;
            border: none;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .btn-block i, .btn-unblock i, .btn-disconnect i {
            margin-right: 8px;
        }
        
        .btn-block {
            background-color: #e74c3c;
            color: white;
        }
        
        .btn-unblock {
            background-color: #2ecc71;
            color: white;
        }
        
        .btn-disconnect {
            background-color: #7f8c8d;
            color: white;
        }
        
        .btn-block:hover, .btn-unblock:hover, .btn-disconnect:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .btn-add-device, .btn-stop-scanning {
            background-color: #8c52ff;
            color: white;
            margin: 15px auto;
            width: fit-content;
        }
        
        .qr-container {
            border-radius: 8px;
            overflow: hidden;
            margin: 20px 0;
        }
        
        #qr-reader {
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid #8c52ff;
        }
        
        .status-indicator {
            width: 15px;
            height: 15px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 10px;
        }
        
        .status-connected {
            background-color: #2ecc71;
            box-shadow: 0 0 10px #2ecc71;
        }
        
        .status-disconnected {
            background-color: #e74c3c;
            box-shadow: 0 0 10px #e74c3c;
        }
        
        .device-list {
            margin-top: 20px;
        }
        
        .device-item {
            background-color: #2d1b4e;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 15px;
        }
        
        .active-device {
            border: 2px solid #8c52ff;
            box-shadow: 0 0 15px rgba(140, 82, 255, 0.5);
        }

        .device-online {
        border-left: 4px solid #2ecc71;
    }
    
    .device-offline {
        border-left: 4px solid #e74c3c;
        background-color: rgba(231, 76, 60, 0.1);
    }
    
    .offline-alert {
        color: #e74c3c;
        font-weight: bold;
        margin-top: 5px;
        padding: 5px;
        background-color: rgba(231, 76, 60, 0.1);
        border-radius: 4px;
    }
    
    .monitoring-container {
        margin-top: 20px;
    }
    
    .status-summary {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
    }
    
    .status-card {
        flex: 1;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 15px;
        text-align: center;
    }
    
    .status-count {
        font-size: 2rem;
        font-weight: bold;
        margin-top: 10px;
    }
    
    .log-container {
        max-height: 200px;
        overflow-y: auto;
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        padding: 10px;
    }
    
    .log-entry {
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 0.9rem;
    }
    
    .log-time {
        color: #8c52ff;
        margin-right: 10px;
    }
    
    .log-device {
        font-weight: bold;
        margin-right: 10px;
    }
    
    .log-event {
        color: #e74c3c;
    }

    .device-offline {
    border-left: 4px solid #e74c3c;
    background-color: rgba(231, 76, 60, 0.2);
    position: relative;
}

.offline-alert {
    color: #ffffff;
    font-weight: bold;
    margin-top: 5px;
    padding: 8px;
    background-color: rgba(231, 76, 60, 0.7);
    border-radius: 4px;
    text-align: center;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        opacity: 0.7;
    }
    50% {
        opacity: 1;
    }
    100% {
        opacity: 0.7;
    }
}

/* Add a pulsing effect to the disconnected status indicator */
.status-disconnected {
    background-color: #F44336;
    animation: pulse 2s infinite;
}

/* Make the log entries more readable */
.log-entry {
    padding: 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
}

.log-time {
    color: #8c52ff;
    margin-right: 10px;
    font-family: monospace;
}

.log-device {
    font-weight: bold;
    margin-right: 10px;
    color: #ffffff;
}

.log-event {
    color: #e74c3c;
    font-weight: bold;
}

.device-offline {
    border-left: 4px solid #e74c3c;
    background-color: rgba(231, 76, 60, 0.2);
    position: relative;
}

.offline-alert {
    color: #ffffff;
    font-weight: bold;
    margin-top: 5px;
    padding: 8px;
    background-color: rgba(231, 76, 60, 0.7);
    border-radius: 4px;
    text-align: center;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        opacity: 0.7;
    }
    50% {
        opacity: 1;
    }
    100% {
        opacity: 0.7;
    }
}

.status-disconnected {
    background-color: #e74c3c;
    animation: pulse 2s infinite;
}

.browser-offline-alert {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background-color: #e74c3c;
    color: white;
    text-align: center;
    padding: 10px;
    font-weight: bold;
    z-index: 9999;
    animation: pulse 2s infinite;
}

.online-alert {
    color: #ffffff;
    font-weight: bold;
    margin-top: 5px;
    padding: 8px;
    background-color: rgba(46, 204, 113, 0.7);
    border-radius: 4px;
    text-align: center;
    animation: fadeOut 5s forwards;
}

@keyframes fadeOut {
    0% {
        opacity: 1;
    }
    80% {
        opacity: 1;
    }
    100% {
        opacity: 0;
    }
}

.notification-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background-color: #e74c3c;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    animation: pulse 2s infinite;
}

#qr-reader-error, #camera-error-display {
    color: white;
    background-color: rgba(231, 76, 60, 0.7);
    padding: 10px;
    border-radius: 5px;
    margin: 10px 0;
    text-align: center;
    font-weight: bold;
}

.device-name {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 5px;
    color: #ffffff;
}

.device-id {
    font-size: 12px;
    opacity: 0.7;
    color: #cccccc;
}

.status-count {
    font-size: 2rem;
    font-weight: bold;
    margin-top: 10px;
}
    </style>
</head>
<body>
    <input type="hidden" id="teacherId" value="<?php echo $_SESSION['teacher_id']; ?>">
    <div class="container">
        <div class="card">
            <div class="header-container">
                <a href="landingpage.php" class="back-button">
                    <i class="fas fa-arrow-left"></i> Back to Home
                </a>
                <h1 class="page-title">EDULOCK CONTROLLER</h1>
                <div style="width: 120px;"></div> <!-- Spacer for balance -->
            </div>
            
            <div class="content-container">
                <div id="connectionSection" class="section-container">
                    <h2>Connection Status</h2>
                    <div id="statusIndicator" class="status">
                        <div class="status-indicator status-disconnected"></div>
                        <span>Disconnected</span>
                    </div>
                    
                    <div id="deviceInfo" class="hidden">
                        <p>Active Device: <span id="deviceIdDisplay">-</span></p>
                        <p>Status: <span id="blockStatusDisplay">-</span></p>
                    </div>
                    
                    <div id="controlPanel" class="hidden">
                        <h2>Device Controls</h2>
                        <div class="control-buttons">
                            <button id="blockButton" class="btn-block">
                                <i class="fas fa-ban"></i> Block Device
                            </button>
                            <button id="unblockButton" class="btn-unblock">
                                <i class="fas fa-unlock"></i> Unblock Device
                            </button>
                            <button id="disconnectButton" class="btn-disconnect">
                                <i class="fas fa-power-off"></i> Disconnect
                            </button>
                        </div>

                        <div id="deviceList" class="device-list hidden"></div>
                        <button id="addDeviceButton" class="btn-add-device" style="display: none;">
                            <i class="fas fa-plus"></i> Add Another Device
                        </button>
                    </div>
                </div>

                <!-- Add Device Monitoring Section -->
                <div id="monitoringSection" class="section-container">
                    <h2>Device Monitoring</h2>
                    <div class="monitoring-container">
                        <div class="status-summary">
                            <div class="status-card">
                                <h3>Connected Devices</h3>
                                <div id="connectedCount" class="status-count">0</div>
                            </div>
                            <div class="status-card">
                                <h3>Offline Devices</h3>
                                <div id="offlineCount" class="status-count">0</div>
                            </div>
                        </div>
                        
                        <h3>Disconnection Log</h3>
                        <div id="disconnectionLog" class="log-container">
                            <!-- Disconnection events will be added here -->
                        </div>
                    </div>
                </div>
                
                <div id="setupSection" class="section-container">
                    <h2>Connect to Device</h2>
                    <p>Scan the QR code from the EduLock app on the device you want to control</p>

                    <div class="qr-container">
                        <div id="qr-reader" style="width: 100%; min-height: 300px;"></div>
                        <div id="qr-reader-results"></div>
                    </div>
                    
                    <div id="pairingSection" class="hidden">
                        <p>Pairing Code: <span id="pairingCodeDisplay">-</span></p>
                        <button id="pairButton" class="btn-add-device">
                            <i class="fas fa-link"></i> Connect to Device
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <input type="hidden" id="teacherId" value="<?php echo $_SESSION['teacher_id']; ?>">

    <script src="scripts.js"></script>
</body>
</html>