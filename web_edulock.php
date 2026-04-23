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

    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        /* ─── Reset & Base ─── */
        *,
        *::before,
        *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        :root {
            --bg-base: #0a0a0e;
            --bg-surface: #111118;
            --bg-raised: #18181f;
            --bg-hover: #1e1e28;
            --border: rgba(255, 255, 255, 0.07);
            --border-focus: rgba(124, 58, 237, 0.55);

            --accent: #7c3aed;
            --accent-light: #9d6aff;
            --accent-dim: rgba(124, 58, 237, 0.12);

            --green: #16a34a;
            --green-bright: #22c55e;
            --green-dim: rgba(22, 163, 74, 0.12);
            --red: #dc2626;
            --red-bright: #ef4444;
            --red-dim: rgba(220, 38, 38, 0.12);
            --amber: #d97706;

            --text-primary: #eeeef5;
            --text-secondary: #8888aa;
            --text-muted: #4a4a68;

            --radius-sm: 6px;
            --radius-md: 10px;
            --radius-lg: 14px;
            --radius-xl: 999px;

            --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.5);
            --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.55);
            --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.65);

            --transition: 0.18s ease;
        }

        html,
        body {
            height: 100%;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            background-color: var(--bg-base);
            color: var(--text-primary);
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        /* ─── Topbar ─── */
        .topbar {
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 28px;
            height: 58px;
            background: rgba(10, 10, 14, 0.96);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border);
        }

        .topbar-left {
            min-width: 180px;
        }

        .topbar-right {
            min-width: 180px;
            display: flex;
            justify-content: flex-end;
        }

        .brand-logo {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .brand-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: var(--accent);
            border-radius: var(--radius-sm);
            font-size: 15px;
            color: white;
        }

        .brand-name {
            font-size: 17px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.4px;
        }

        .topbar-center {
            flex: 1;
            text-align: center;
        }

        .topbar-title {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-muted);
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .nav-home-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 14px;
            background: var(--bg-raised);
            color: var(--text-secondary);
            text-decoration: none;
            border-radius: var(--radius-sm);
            font-size: 12px;
            font-weight: 500;
            border: 1px solid var(--border);
            transition: all var(--transition);
        }

        .nav-home-btn:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
            border-color: var(--border-focus);
        }

        /* ─── Page Layout ─── */
        .page-wrapper {
            display: grid;
            grid-template-columns: 400px 1fr;
            gap: 20px;
            padding: 24px;
            max-width: 1180px;
            margin: 0 auto;
        }

        .col-left,
        .col-right {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        /* ─── Panel ─── */
        .panel {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            overflow: hidden;
            box-shadow: var(--shadow-sm);
        }

        .panel-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 13px 20px;
            background: var(--bg-raised);
            border-bottom: 1px solid var(--border);
        }

        .panel-header i {
            color: var(--accent-light);
            font-size: 13px;
        }

        .panel-header h2 {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            letter-spacing: 0.03em;
        }

        .panel-body {
            padding: 20px;
        }

        .panel-desc {
            color: var(--text-secondary);
            font-size: 13px;
            margin-bottom: 16px;
            line-height: 1.6;
        }

        .section-label {
            font-size: 10px;
            font-weight: 600;
            color: var(--text-muted);
            letter-spacing: 0.12em;
            text-transform: uppercase;
            margin-bottom: 12px;
        }

        /* ─── Status Badge ─── */
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 14px;
            border-radius: var(--radius-xl);
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 18px;
        }

        .status-badge.status-connected {
            background: var(--green-dim);
            color: var(--green-bright);
            border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .status-badge.status-disconnected {
            background: var(--red-dim);
            color: var(--red-bright);
            border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: currentColor;
            flex-shrink: 0;
        }

        .status-badge.status-connected .status-dot {
            animation: pulse-green 2s infinite;
        }

        .status-badge.status-disconnected .status-dot {
            animation: pulse-red 2s infinite;
        }

        @keyframes pulse-green {

            0%,
            100% {
                box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45);
            }

            50% {
                box-shadow: 0 0 0 5px rgba(34, 197, 94, 0);
            }
        }

        @keyframes pulse-red {

            0%,
            100% {
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45);
            }

            50% {
                box-shadow: 0 0 0 5px rgba(239, 68, 68, 0);
            }
        }

        /* ─── Device Info Block ─── */
        .device-info-block {
            background: var(--bg-raised);
            border-radius: var(--radius-md);
            padding: 12px 14px;
            margin-bottom: 18px;
            border: 1px solid var(--border);
        }

        .info-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 5px 0;
        }

        .info-row:not(:last-child) {
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
            margin-bottom: 5px;
        }

        .info-label {
            font-size: 11px;
            color: var(--text-muted);
            font-weight: 500;
        }

        .info-value {
            font-size: 12px;
            color: var(--text-primary);
            font-weight: 600;
        }

        /* ─── Buttons ─── */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 15px;
            border: none;
            border-radius: var(--radius-sm);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all var(--transition);
            white-space: nowrap;
            font-family: inherit;
        }

        .btn:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        .btn:active {
            transform: none;
            box-shadow: none;
        }

        .btn:disabled {
            opacity: 0.35;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .btn-block {
            background: var(--red-dim);
            color: var(--red-bright);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .btn-block:hover {
            background: rgba(239, 68, 68, 0.22);
        }

        .btn-unblock {
            background: var(--green-dim);
            color: var(--green-bright);
            border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .btn-unblock:hover {
            background: rgba(34, 197, 94, 0.22);
        }

        .btn-disconnect {
            background: var(--bg-hover);
            color: var(--text-secondary);
            border: 1px solid var(--border);
        }

        .btn-disconnect:hover {
            background: rgba(255, 255, 255, 0.07);
            color: var(--text-primary);
        }

        .btn-add-device {
            background: var(--accent);
            color: white;
            border: 1px solid transparent;
            margin-top: 14px;
        }

        .btn-add-device:hover {
            background: var(--accent-light);
        }

        /* Camera toggle — two states */
        .btn-camera-on {
            background: var(--accent);
            color: white;
            border: 1px solid transparent;
            flex-shrink: 0;
        }

        .btn-camera-on:hover {
            background: var(--accent-light);
        }

        .btn-camera-off {
            background: var(--red-dim);
            color: var(--red-bright);
            border: 1px solid rgba(239, 68, 68, 0.25);
            flex-shrink: 0;
        }

        .btn-camera-off:hover {
            background: rgba(239, 68, 68, 0.22);
        }

        .control-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 18px;
        }

        /* ─── Device List ─── */
        .device-list {
            margin-top: 14px;
        }

        .device-list-header {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-muted);
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 10px;
        }

        .device-item {
            background: var(--bg-raised);
            border: 1px solid var(--border);
            border-left: 3px solid var(--border);
            border-radius: var(--radius-md);
            padding: 12px 14px;
            margin-bottom: 9px;
            transition: border-color var(--transition), background var(--transition);
        }

        .device-item.device-online {
            border-left-color: var(--green-bright);
        }

        .device-item.device-offline {
            border-left-color: var(--red-bright);
            opacity: 0.7;
        }

        .device-item.active-device {
            border-color: var(--accent-light);
            background: var(--accent-dim);
            box-shadow: 0 0 0 1px var(--accent-light) inset;
        }

        .device-info-row {
            cursor: pointer;
            margin-bottom: 8px;
        }

        .device-info-row:hover .device-name {
            color: var(--accent-light);
        }

        .device-name {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            transition: color var(--transition);
        }

        .device-id {
            font-size: 10px;
            color: var(--text-muted);
            margin-top: 2px;
            font-family: 'Courier New', monospace;
        }

        .device-status {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 10px;
        }

        .device-controls {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .device-controls .btn {
            font-size: 11px;
            padding: 4px 10px;
        }

        .offline-alert {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            font-weight: 600;
            color: var(--red-bright);
            background: var(--red-dim);
            padding: 2px 8px;
            border-radius: var(--radius-xl);
        }

        /* ─── Status Summary ─── */
        .status-summary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 8px;
        }

        .stat-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 16px;
            border-radius: var(--radius-md);
            border: 1px solid var(--border);
        }

        .stat-card.stat-online {
            background: var(--green-dim);
            border-color: rgba(34, 197, 94, 0.18);
        }

        .stat-card.stat-offline {
            background: var(--red-dim);
            border-color: rgba(239, 68, 68, 0.18);
        }

        .stat-icon {
            font-size: 20px;
        }

        .stat-card.stat-online .stat-icon {
            color: var(--green-bright);
        }

        .stat-card.stat-offline .stat-icon {
            color: var(--red-bright);
        }

        .stat-label {
            font-size: 10px;
            font-weight: 600;
            color: var(--text-muted);
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .stat-value {
            font-size: 28px;
            font-weight: 700;
            line-height: 1.1;
        }

        .stat-card.stat-online .stat-value {
            color: var(--green-bright);
        }

        .stat-card.stat-offline .stat-value {
            color: var(--red-bright);
        }

        /* ─── Disconnection Log ─── */
        .log-container {
            max-height: 220px;
            overflow-y: auto;
            background: var(--bg-base);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 6px;
            scrollbar-width: thin;
            scrollbar-color: var(--bg-hover) transparent;
        }

        .log-empty {
            text-align: center;
            color: var(--text-muted);
            font-size: 12px;
            padding: 20px;
        }

        .log-entry {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 10px;
            border-radius: var(--radius-sm);
            border-bottom: 1px solid var(--border);
            font-size: 12px;
        }

        .log-entry:last-child {
            border-bottom: none;
        }

        .log-entry:hover {
            background: var(--bg-raised);
        }

        .log-time {
            font-family: 'Courier New', monospace;
            color: var(--accent-light);
            white-space: nowrap;
            flex-shrink: 0;
            font-size: 10px;
        }

        .log-device {
            font-weight: 600;
            color: var(--text-primary);
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .log-event {
            flex-shrink: 0;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 99px;
            font-size: 10px;
            letter-spacing: 0.04em;
        }

        .log-event.disconnected {
            background: var(--red-dim);
            color: var(--red-bright);
        }

        .log-event.connected {
            background: var(--green-dim);
            color: var(--green-bright);
        }

        /* ─── Camera Controls ─── */
        .camera-controls-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 14px;
        }

        .camera-select {
            flex: 1;
            padding: 8px 12px;
            background: var(--bg-raised);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            font-size: 12px;
            font-family: inherit;
            cursor: pointer;
            outline: none;
            transition: border-color var(--transition);
        }

        .camera-select:focus {
            border-color: var(--border-focus);
        }

        .camera-select option {
            background: var(--bg-raised);
        }

        /* ─── QR Wrapper & Camera ─── */
        .qr-wrapper {
            position: relative;
            width: 100%;
            aspect-ratio: 4 / 3;
            background: #05050a;
            border-radius: var(--radius-md);
            border: 1px solid var(--border);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #qr-reader {
            position: absolute;
            inset: 0;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden;
        }

        /* Un-mirror the camera — right is right, left is left */
        #qr-reader video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover;
            display: block;
            transform: scaleX(-1);
        }

        /* Hide html5-qrcode default controls */
        #qr-reader__dashboard {
            display: none !important;
        }

        #qr-reader__scan_region {
            background: transparent !important;
        }

        #qr-reader__scan_region img {
            display: none !important;
        }

        /* Camera placeholder */
        .camera-placeholder {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #05050a;
            color: var(--text-muted);
            gap: 10px;
            z-index: 5;
        }

        .camera-placeholder i {
            font-size: 44px;
            color: var(--text-muted);
            opacity: 0.5;
        }

        .camera-placeholder p {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-secondary);
        }

        .placeholder-sub {
            font-size: 11px !important;
            color: var(--text-muted) !important;
            font-weight: 400 !important;
        }

        /* Camera error banner */
        .camera-error {
            background: var(--red-dim);
            border: 1px solid rgba(239, 68, 68, 0.28);
            color: var(--red-bright);
            padding: 10px 14px;
            border-radius: var(--radius-sm);
            font-size: 12px;
            margin-bottom: 12px;
        }

        .hidden {
            display: none !important;
        }

        /* ─── Pairing Box ─── */
        .pairing-box {
            margin-top: 16px;
            background: var(--bg-raised);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 16px;
            text-align: center;
            font-size: 13px;
            color: var(--text-secondary);
        }

        /* ─── Browser offline alert ─── */
        .browser-offline-alert {
            position: fixed;
            top: 58px;
            left: 0;
            right: 0;
            background: var(--red);
            color: white;
            text-align: center;
            padding: 9px 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 9999;
            letter-spacing: 0.03em;
        }

        /* ─── Responsive ─── */
        @media (max-width: 860px) {
            .page-wrapper {
                grid-template-columns: 1fr;
                padding: 14px;
            }

            .topbar-center .topbar-title {
                display: none;
            }

            .topbar-left,
            .topbar-right {
                min-width: auto;
            }

            .nav-home-btn span {
                display: none;
            }

            .status-summary {
                grid-template-columns: 1fr 1fr;
            }
        }
    </style>
</head>

<body>
    <input type="hidden" id="teacherId" value="<?php echo $_SESSION['teacher_id']; ?>">

    <!-- Top navigation bar -->
    <nav class="topbar">
        <div class="topbar-left">
            <div class="brand-logo">
                <span class="brand-icon"><i class="fas fa-shield-alt"></i></span>
                <span class="brand-name">EduLock</span>
            </div>
        </div>
        <div class="topbar-center">
            <span class="topbar-title">Device Controller</span>
        </div>
        <div class="topbar-right">
            <a href="landingpage.php" class="nav-home-btn">
                <i class="fas fa-arrow-left"></i>
                <span>Back to Home</span>
            </a>
        </div>
    </nav>

    <div class="page-wrapper">

        <!-- LEFT COLUMN -->
        <div class="col-left">

            <!-- Connection Status Card -->
            <div class="panel">
                <div class="panel-header">
                    <i class="fas fa-signal"></i>
                    <h2>Connection Status</h2>
                </div>
                <div class="panel-body">
                    <div id="statusIndicator" class="status-badge status-disconnected">
                        <span class="status-dot"></span>
                        <span class="status-label">Disconnected</span>
                    </div>

                    <div id="deviceInfo" class="hidden device-info-block">
                        <div class="info-row">
                            <span class="info-label">Active Device</span>
                            <span id="deviceIdDisplay" class="info-value">—</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Block Status</span>
                            <span id="blockStatusDisplay" class="info-value">—</span>
                        </div>
                    </div>

                    <div id="controlPanel" class="hidden">
                        <div class="section-label">Global Controls</div>
                        <div class="control-buttons">
                            <button id="blockButton" class="btn btn-block">
                                <i class="fas fa-ban"></i> Block All
                            </button>
                            <button id="unblockButton" class="btn btn-unblock">
                                <i class="fas fa-unlock"></i> Unblock All
                            </button>
                            <button id="disconnectButton" class="btn btn-disconnect">
                                <i class="fas fa-power-off"></i> Disconnect All
                            </button>
                        </div>

                        <!-- Device List populated by JS -->
                        <div id="deviceListAnchor"></div>

                        <button id="addDeviceButton" class="btn btn-add-device" style="display: none;">
                            <i class="fas fa-plus"></i> Add Another Device
                        </button>
                    </div>
                </div>
            </div>

            <!-- Device Monitoring Card -->
            <div class="panel">
                <div class="panel-header">
                    <i class="fas fa-chart-bar"></i>
                    <h2>Device Monitoring</h2>
                </div>
                <div class="panel-body">
                    <div class="status-summary">
                        <div class="stat-card stat-online">
                            <div class="stat-icon"><i class="fas fa-mobile-alt"></i></div>
                            <div class="stat-body">
                                <div class="stat-label">Connected</div>
                                <div id="connectedCount" class="stat-value">0</div>
                            </div>
                        </div>
                        <div class="stat-card stat-offline">
                            <div class="stat-icon"><i class="fas fa-mobile"></i></div>
                            <div class="stat-body">
                                <div class="stat-label">Offline</div>
                                <div id="offlineCount" class="stat-value">0</div>
                            </div>
                        </div>
                    </div>

                    <div class="section-label" style="margin-top: 20px;">Disconnection Log</div>
                    <div id="disconnectionLog" class="log-container">
                        <div class="log-empty">No events yet</div>
                    </div>
                </div>
            </div>

        </div>

        <!-- RIGHT COLUMN -->
        <div class="col-right">

            <!-- QR Scanner Card -->
            <div class="panel">
                <div class="panel-header">
                    <i class="fas fa-qrcode"></i>
                    <h2>Connect to Device</h2>
                </div>
                <div class="panel-body">
                    <p class="panel-desc">Scan the QR code from the EduLock app on the student's device to pair it.</p>

                    <!-- Camera controls bar -->
                    <div class="camera-controls-bar">
                        <select id="cameraSelection" class="camera-select">
                            <option>Loading cameras...</option>
                        </select>
                        <button id="cameraToggleBtn" class="btn btn-camera-on" onclick="toggleCamera()">
                            <i class="fas fa-video"></i> Camera On
                        </button>
                    </div>

                    <!-- Error display -->
                    <div id="camera-error-display" class="camera-error hidden"></div>

                    <!-- QR Reader container -->
                    <div class="qr-wrapper">
                        <div id="qr-reader"></div>
                        <div id="qr-reader-results"></div>
                        <div id="camera-placeholder" class="camera-placeholder">
                            <i class="fas fa-video-slash"></i>
                            <p>Camera is off</p>
                            <p class="placeholder-sub">Click "Camera On" to start scanning</p>
                        </div>
                    </div>

                    <!-- Pairing section -->
                    <div id="pairingSection" class="hidden pairing-box">
                        <p>Pairing Code: <strong id="pairingCodeDisplay">—</strong></p>
                        <button id="pairButton" class="btn btn-add-device">
                            <i class="fas fa-link"></i> Connect to Device
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>


    <script src="js/state.js"></script>
    <script src="js/firebase-init.js"></script>
    <script src="js/dom.js"></script>
    <script src="js/camera.js"></script>
    <script src="js/qr.js"></script>
    <script src="js/devices.js"></script>
    <script src="js/block.js"></script>
    <script src="js/device-ui.js"></script>
    <script src="js/logs.js"></script>
    <script src="js/status.js"></script>
    <script src="js/firestore.js"></script>
    <script src="js/lifecycle.js"></script>
    <script src="js/main.js"></script>

</body>

</html>