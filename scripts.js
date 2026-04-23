// ─── Firebase Config ───
const firebaseConfig = {
    apiKey: "AIzaSyBPyX-vMxXf-Wn4Rx9jKlHUWYWYWcxqpuM",
    authDomain: "edulock-register-firebase.firebaseapp.com",
    databaseURL: "https://edulock-register-firebase-default-rtdb.firebaseio.com",
    projectId: "edulock-register-firebase",
    storageBucket: "edulock-register-firebase.appspot.com",
    messagingSenderId: "1039430447528",
    appId: "1:1039430447528:web:c4f4514659a2a2c24d5e0c"
};

// ─── State ───
let database;
let firestore;
let html5QrCode = null;
let isCameraOn  = false;

let connectedDevices  = [];
let connectedDeviceId = null;
let isDeviceBlocked   = false;
let deviceStatusMap   = {};

// Tracks device IDs currently in offline state, independent of connectedDevices array.
// This survives device removal so the counter doesn't silently reset to 0.
let sessionOfflineSet = new Set();

// Holds info about devices that have gone offline so we can:
//   1) show a reason in the disconnection log
//   2) recognize the SAME phone when it reconnects with a new QR code,
//      so we revive the offline row instead of creating a duplicate.
// Keyed by deviceId → { hardwareId, userId, displayName, lastPing, removedAt, reason }
let offlineDeviceInfo = {};

// Quick lookup table: identityKey → offline deviceId (for reconnect dedupe).
// identityKey is hw:<hardwareId>, uid:<userId>, or nm:<lowercased name>.
let offlineIdentityIndex = {};

function _identityKeysFor(d) {
    const keys = [];
    if (d && d.hardwareId)  keys.push('hw:'  + d.hardwareId);
    if (d && d.userId)      keys.push('uid:' + d.userId);
    if (d && d.displayName) keys.push('nm:'  + String(d.displayName).trim().toLowerCase());
    return keys;
}

function _registerOfflineIdentity(deviceId, info) {
    offlineDeviceInfo[deviceId] = info;
    _identityKeysFor(info).forEach(k => { offlineIdentityIndex[k] = deviceId; });
}

function _findOfflineMatch(info) {
    const keys = _identityKeysFor(info);
    for (const k of keys) {
        if (offlineIdentityIndex[k]) return offlineIdentityIndex[k];
    }
    return null;
}

function _clearOfflineIdentity(deviceId) {
    const info = offlineDeviceInfo[deviceId];
    if (info) {
        _identityKeysFor(info).forEach(k => {
            if (offlineIdentityIndex[k] === deviceId) delete offlineIdentityIndex[k];
        });
    }
    delete offlineDeviceInfo[deviceId];
    sessionOfflineSet.delete(deviceId);
}

// ─── Init Firebase ───
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    database  = firebase.database();
    firestore = firebase.firestore();
    firestore.settings({ merge: true });
} catch (e) {
    console.error('Firebase init error:', e);
}

// ─── DOM refs ───
const statusIndicator    = document.getElementById('statusIndicator');
const deviceInfo         = document.getElementById('deviceInfo');
const controlPanel       = document.getElementById('controlPanel');
const pairingSection     = document.getElementById('pairingSection');
const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
const deviceIdDisplay    = document.getElementById('deviceIdDisplay');
const blockStatusDisplay = document.getElementById('blockStatusDisplay');
const blockButton        = document.getElementById('blockButton');
const unblockButton      = document.getElementById('unblockButton');
const disconnectButton   = document.getElementById('disconnectButton');
const pairButton         = document.getElementById('pairButton');

// Device list container (injected into #deviceListAnchor)
const deviceListContainer = document.createElement('div');
deviceListContainer.id = 'deviceList';
deviceListContainer.className = 'device-list';

// ═══════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {
    // Mount device list
    const anchor = document.getElementById('deviceListAnchor');
    if (anchor) anchor.appendChild(deviceListContainer);

    // Button wiring
    document.getElementById('addDeviceButton')
        ?.addEventListener('click', startMultiDeviceScanning);

    if (blockButton)      blockButton.addEventListener('click', blockAllDevices);
    if (unblockButton)    unblockButton.addEventListener('click', unblockAllDevices);
    if (disconnectButton) disconnectButton.addEventListener('click', disconnectFromDevice);

    // Init QR scanner element — but do NOT auto-start camera
    const qrEl = document.getElementById('qr-reader');
    if (qrEl) {
        try {
            html5QrCode = new Html5Qrcode('qr-reader');
        } catch (e) {
            console.error('QR scanner init error:', e);
        }
    }

    // Populate camera dropdown WITHOUT starting the camera
    populateCameraList();

    // Firebase connectivity log
    database.ref('.info/connected').on('value', snap => {
        console.log('Firebase connected:', snap.val());
    });

    // Background monitors
    startStatusMonitor();
    startHeartbeat();
    startHeartbeatMonitoring();
    startPeriodicStatusCheck();
    setupBrowserConnectivityMonitor();
    handlePageRefresh();
    setupPageUnloadHandler();

    // URL pairing code support
    const urlParams   = new URLSearchParams(window.location.search);
    const pairingCode = urlParams.get('code');
    if (pairingCode) handlePairingCode(pairingCode);

    setTimeout(loadUserDataForDevices, 2000);
});

// ═══════════════════════════════════════
//  CAMERA MANAGEMENT
// ═══════════════════════════════════════

/**
 * Populate the camera dropdown without starting the camera.
 * Camera only starts when the user clicks "Camera On".
 */
function populateCameraList() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            // Release immediately — we just needed permission to list
            stream.getTracks().forEach(t => t.stop());
            return Html5Qrcode.getCameras();
        })
        .then(devices => {
            if (!devices || !devices.length) {
                showCameraError('No cameras found on this device.');
                return;
            }

            const select = document.getElementById('cameraSelection');
            select.innerHTML = '';
            devices.forEach((dev, i) => {
                const opt = document.createElement('option');
                opt.value = dev.id;
                opt.text  = dev.label || `Camera ${i + 1}`;
                select.appendChild(opt);
            });

            select.addEventListener('change', function () {
                if (isCameraOn) {
                    stopCamera().then(() => startCamera(this.value));
                }
            });
        })
        .catch(err => {
            console.error('Camera permission error:', err);
            let msg = 'Camera error: ';
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg += 'Permission denied. Please allow camera access in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                msg += 'No camera found.';
            } else if (err.name === 'NotReadableError') {
                msg += 'Camera is in use by another application.';
            } else {
                msg += err.message || 'Unknown error.';
            }
            showCameraError(msg);
        });
}

/**
 * Toggle camera on / off — wired to the HTML button via onclick="toggleCamera()".
 */
function toggleCamera() {
    if (isCameraOn) {
        stopCamera();
    } else {
        const select   = document.getElementById('cameraSelection');
        const deviceId = select && select.value ? select.value : null;
        startCamera(deviceId);
    }
}

/**
 * Start the camera and QR scanner.
 */
function startCamera(deviceId) {
    if (!html5QrCode) {
        console.error('QR scanner not initialized');
        return;
    }

    const placeholder = document.getElementById('camera-placeholder');
    const toggleBtn   = document.getElementById('cameraToggleBtn');

    const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.333,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    };

    const camConfig = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: 'environment' };

    html5QrCode.start(
        camConfig,
        config,
        (decodedText) => onQRCodeSuccess(decodedText),
        () => { /* silent scan errors */ }
    ).then(() => {
        isCameraOn = true;
        if (placeholder) placeholder.style.display = 'none';

        if (toggleBtn) {
            toggleBtn.className = 'btn btn-camera-off';
            toggleBtn.innerHTML = '<i class="fas fa-video-slash"></i> Camera Off';
        }

        // Ensure video fills the wrapper
        setTimeout(() => {
            const video = document.querySelector('#qr-reader video');
            if (video) {
                video.style.width     = '100%';
                video.style.height    = '100%';
                video.style.objectFit = 'cover';
                video.style.display   = 'block';
            }
        }, 800);
    }).catch(err => {
        console.error('Camera start error:', err);
        showCameraError('Could not start camera: ' + (err.message || err));
        isCameraOn = false;
    });
}

/**
 * Stop the camera and show the placeholder.
 */
function stopCamera() {
    if (!html5QrCode) return Promise.resolve();

    return html5QrCode.stop().then(() => {
        isCameraOn = false;

        const placeholder = document.getElementById('camera-placeholder');
        const toggleBtn   = document.getElementById('cameraToggleBtn');

        if (placeholder) placeholder.style.display = '';
        if (toggleBtn) {
            toggleBtn.className = 'btn btn-camera-on';
            toggleBtn.innerHTML = '<i class="fas fa-video"></i> Camera On';
        }
    }).catch(err => {
        console.error('Camera stop error (ignored):', err);
        isCameraOn = false;
    });
}

/**
 * Restart camera after a QR scan — only if the user had it on.
 * Device disconnections do NOT affect this.
 */
function restartCamera() {
    if (!isCameraOn) return;

    const select   = document.getElementById('cameraSelection');
    const deviceId = select && select.value ? select.value : null;

    stopCamera().then(() => {
        setTimeout(() => startCamera(deviceId), 500);
    });
}

function getOrCreateErrorDisplay() {
    let el = document.getElementById('camera-error-display');
    if (!el) {
        el = document.createElement('div');
        el.id = 'camera-error-display';
        el.className = 'camera-error hidden';
        const wrapper = document.querySelector('.qr-wrapper');
        if (wrapper) wrapper.before(el);
    }
    return el;
}

function showCameraError(msg) {
    const el = getOrCreateErrorDisplay();
    el.textContent = msg;
    el.classList.remove('hidden');
}

// ═══════════════════════════════════════
//  QR CODE HANDLING
// ═══════════════════════════════════════

async function onQRCodeSuccess(decodedText) {
    console.log('QR code detected:', decodedText);

    try {
        if (html5QrCode && isCameraOn) {
            await html5QrCode.pause(true);
        }

        // Extract device code
        let code = null;
        if (/^[0-9a-f\-]+$/i.test(decodedText)) {
            code = decodedText;
        } else {
            try {
                code = new URL(decodedText).searchParams.get('code');
            } catch (e) {
                code = decodedText;
            }
        }

        if (!code || code.length < 5) {
            throw new Error('Invalid QR code format. Please scan a valid EduLock QR code.');
        }

        if (connectedDevices.some(d => d.id === code)) {
            throw new Error('This device is already connected.');
        }

        const snapshot = await database.ref(`registered_devices/${code}`).once('value');
        if (!snapshot.exists()) throw new Error('Device not found. Please try again.');

        const deviceData = snapshot.val();

        // Debug: log device data keys to help identify the correct userId field
        console.log('[EduLock] Device data from RTDB:', JSON.stringify(deviceData));

        await database.ref(`registered_devices/${code}`).update({
            controllerConnected: false,
            isBlocked: false
        });
        await new Promise(r => setTimeout(r, 800));

        // Resolve display name — try every likely userId field the Android app might save
        const uid = deviceData.userId
                 || deviceData.uid
                 || deviceData.userUid
                 || deviceData.user_id
                 || deviceData.ownerId
                 || deviceData.registeredBy
                 || null;

        if (uid) {
            console.log('[EduLock] Looking up user with UID:', uid);
            const userData = await getUserInfo(uid);
            if (userData) {
                const displayName = `${userData.firstName} ${userData.lastName}`.trim();
                await database.ref(`registered_devices/${code}`).update({ displayName, resolvedUserId: uid });
                deviceData.displayName = displayName;
                deviceData.userId = uid;
                console.log('[EduLock] Resolved display name:', displayName);
            } else {
                console.warn('[EduLock] User UID found but no Firestore document at users/' + uid);
            }
        } else {
            // No UID field — use whatever name is stored directly in RTDB
            // The Android app stores the name as "deviceName" field
            const directName = deviceData.deviceName
                            || deviceData.displayName
                            || deviceData.name
                            || deviceData.studentName
                            || deviceData.userName
                            || null;
            if (directName) {
                deviceData.displayName = directName;
                console.log('[EduLock] Using name from RTDB directly:', directName);
            } else {
                console.warn('[EduLock] No userId or name found in device data. Fields:', Object.keys(deviceData));
                console.info('[EduLock] To enable real name lookup, add the Firebase Auth UID to the device entry in your Android app.');
            }
        }

        await connectToDevice(code);

        // Resume so more devices can be scanned
        if (html5QrCode && isCameraOn) {
            html5QrCode.resume();
        }

    } catch (err) {
        console.error('QR processing error:', err);
        alert('Connection error: ' + err.message);

        if (html5QrCode && isCameraOn) {
            try { html5QrCode.resume(); } catch (e) { restartCamera(); }
        }
    }
}

// ═══════════════════════════════════════
//  DEVICE CONNECTION
// ═══════════════════════════════════════

function connectToDevice(deviceId) {
    return new Promise((resolve, reject) => {
        database.ref(`registered_devices/${deviceId}`).once('value')
            .then(snapshot => {
                if (!snapshot.exists()) { reject(new Error('Device not found')); return; }

                const deviceData = snapshot.val();

                // Resolve display name — Android app stores it as "deviceName"
                const resolvedName = deviceData.displayName
                                  || deviceData.deviceName
                                  || deviceData.name
                                  || null;

                // Resolve UID from any field name the Android app might use
                const resolvedUid = deviceData.userId
                                 || deviceData.uid
                                 || deviceData.userUid
                                 || deviceData.user_id
                                 || deviceData.ownerId
                                 || deviceData.registeredBy
                                 || deviceData.resolvedUserId
                                 || null;

                // Stable identifier sent by the Android app — same value across
                // every QR generated by the SAME phone. Used to detect that a
                // reconnecting device is actually one that just went offline,
                // so we update its row instead of creating a duplicate.
                const resolvedHardwareId = deviceData.hardwareId
                                        || deviceData.androidId
                                        || null;

                // ─── Reconnect dedupe ──────────────────────────────────────
                // Look for a previously offline device with the same identity.
                // If we find one, revive that row: drop the old offline id from
                // the offline set / index (so the offline counter decrements)
                // and log a "reconnected" event using the original display name.
                const matchInfo = {
                    hardwareId: resolvedHardwareId,
                    userId:     resolvedUid,
                    displayName: resolvedName
                };
                const previousOfflineId = _findOfflineMatch(matchInfo);
                if (previousOfflineId && previousOfflineId !== deviceId) {
                    const prev = offlineDeviceInfo[previousOfflineId] || {};
                    _clearOfflineIdentity(previousOfflineId);
                    delete deviceStatusMap[previousOfflineId];
                    // Log the comeback under the name we already knew them by
                    logConnectionEventNamed(
                        prev.displayName || resolvedName || `Device …${deviceId.substring(0, 8)}`,
                        Date.now(),
                        'reconnected'
                    );
                }

                // Cross-account dedupe — the same physical phone may appear in
                // connectedDevices under a different account/name (e.g. user
                // signed out, signed in with another account, generated a new
                // QR). When the new entry has the same hardwareId, drop the
                // old row so we never double-list the same device.
                if (resolvedHardwareId) {
                    for (let i = connectedDevices.length - 1; i >= 0; i--) {
                        const d = connectedDevices[i];
                        if (d.id !== deviceId && d.hardwareId === resolvedHardwareId) {
                            // Remove the stale Firebase node too, so it doesn't
                            // come back next refresh.
                            database.ref(`registered_devices/${d.id}`).remove()
                                .catch(() => { /* ignore */ });
                            connectedDevices.splice(i, 1);
                            delete deviceStatusMap[d.id];
                            _clearOfflineIdentity(d.id);
                            if (connectedDeviceId === d.id) connectedDeviceId = deviceId;
                        }
                    }
                }
                // ───────────────────────────────────────────────────────────

                updateConnectionStatus(true);
                deviceIdDisplay.textContent = resolvedName || deviceId.substring(0, 8);
                deviceInfo.classList.remove('hidden');
                controlPanel.classList.remove('hidden');

                connectedDeviceId = deviceId;

                const existingIdx = connectedDevices.findIndex(d => d.id === deviceId);
                if (existingIdx === -1) {
                    connectedDevices.push({
                        id: deviceId,
                        name: resolvedName || `Device ${deviceId.substring(0, 8)}`,
                        displayName: resolvedName,
                        isBlocked: deviceData.isBlocked || false,
                        online: true,
                        userId: resolvedUid,
                        hardwareId: resolvedHardwareId
                    });
                } else {
                    Object.assign(connectedDevices[existingIdx], {
                        isBlocked: deviceData.isBlocked || false,
                        online: true,
                        displayName: resolvedName || connectedDevices[existingIdx].displayName,
                        userId: resolvedUid || connectedDevices[existingIdx].userId,
                        hardwareId: resolvedHardwareId || connectedDevices[existingIdx].hardwareId
                    });
                }

                isDeviceBlocked = deviceData.isBlocked || false;
                updateBlockUI(isDeviceBlocked);

                // Mark online immediately — also clear any leftover offline state
                // for THIS exact deviceId (older session re-pair on the same code)
                deviceStatusMap[deviceId] = 'online';
                _clearOfflineIdentity(deviceId);

                setupDeviceListeners(deviceId);
                setupPresenceDetection(deviceId);
                updateDeviceListUI();
                updateDeviceCounts();

                const addBtn = document.getElementById('addDeviceButton');
                if (addBtn) addBtn.style.display = 'flex';

                database.ref(`registered_devices/${deviceId}/controllerConnected`).set(true)
                    .catch(e => console.error('Error marking connected:', e));

                resolve(deviceData);
            })
            .catch(err => { console.error('Connection error:', err); reject(err); });
    });
}

function setupDeviceListeners(deviceId) {
    database.ref(`registered_devices/${deviceId}/isBlocked`).on('value', snap => {
        const blocked = snap.val();
        const idx = connectedDevices.findIndex(d => d.id === deviceId);
        if (idx !== -1) connectedDevices[idx].isBlocked = blocked;
        if (deviceId === connectedDeviceId) {
            isDeviceBlocked = blocked;
            updateBlockUI(blocked);
        }
        updateDeviceListUI();
    });

    // Ping every 10 s
    const pingInterval = setInterval(() => {
        if (!connectedDevices.some(d => d.id === deviceId)) {
            clearInterval(pingInterval);
            return;
        }
        database.ref(`registered_devices/${deviceId}/lastPing`).set(firebase.database.ServerValue.TIMESTAMP)
            .then(() => database.ref(`registered_devices/${deviceId}/controllerConnected`).once('value'))
            .then(snap => {
                const connected = snap.val();
                // null means the node may have been deleted — treat as offline
                if ((connected === false || connected === null) && deviceStatusMap[deviceId] === 'online') {
                    markDeviceOffline(deviceId);
                } else if (connected === true && deviceStatusMap[deviceId] === 'offline') {
                    markDeviceOnline(deviceId);
                }
            })
            .catch(e => console.error('Ping error:', e));
    }, 10000);

    deviceStatusMap[deviceId + '_pingInterval'] = pingInterval;
}

function setupPresenceDetection(deviceId) {
    // Single listener on the full device node — handles:
    //   • controllerConnected → false  (phone signals disconnect)
    //   • entire node deleted / null   (phone calls removeValue)
    //   • auto-unblock when device goes offline while blocked
    database.ref(`registered_devices/${deviceId}`).on('value', snap => {
        const data      = snap.val();
        const connected = data ? data.controllerConnected : null;

        // Treat missing node OR controllerConnected not true as "offline"
        const isNowOffline = !data || connected === false || connected === null;
        const isNowOnline  = data && connected === true;

        if (isNowOffline && deviceStatusMap[deviceId] === 'online') {
            markDeviceOffline(deviceId);
            // NOTE: we deliberately do NOT auto-unblock here. The teacher's
            // block intent must persist across the student's offline period
            // so the overlay re-applies the moment they regain signal.
        } else if (isNowOnline && deviceStatusMap[deviceId] === 'offline') {
            markDeviceOnline(deviceId);
        }
    });
}

// ═══════════════════════════════════════
//  DISCONNECT
// ═══════════════════════════════════════

function disconnectFromDevice() {
    // disconnectSingleDevice handles its own cleanup and logging per device
    const ids = connectedDevices.map(d => d.id);
    const promises = ids.map(id => disconnectSingleDevice(id));
    Promise.all(promises)
        .then(() => {
            // Final cleanup of anything leftover
            for (const key in deviceStatusMap) {
                if (key.endsWith('_pingInterval') || key.endsWith('_interval')) {
                    clearInterval(deviceStatusMap[key]);
                }
            }
            connectedDevices  = [];
            connectedDeviceId = null;
            isDeviceBlocked   = false;
            deviceStatusMap   = {};

            updateConnectionUI(false);
            updateDeviceListUI();
            updateDeviceCounts();
        })
        .catch(e => {
            console.error('Disconnect error:', e);
            connectedDevices  = [];
            connectedDeviceId = null;
            isDeviceBlocked   = false;
            deviceStatusMap   = {};
            updateConnectionUI(false);
            updateDeviceListUI();
            updateDeviceCounts();
        });
}

function disconnectSingleDevice(deviceId) {
    // 1. Stop all Firebase listeners for this device
    database.ref(`registered_devices/${deviceId}`).off();
    database.ref(`registered_devices/${deviceId}/isBlocked`).off();
    database.ref(`registered_devices/${deviceId}/controllerConnected`).off();

    // 2. Clear ping interval
    ['_pingInterval', '_interval'].forEach(suffix => {
        const key = deviceId + suffix;
        if (deviceStatusMap[key]) { clearInterval(deviceStatusMap[key]); delete deviceStatusMap[key]; }
    });

    // 3. Mark offline using the shared helper — this adds to sessionOfflineSet so the
    //    offline counter increments and STAYS incremented after the device leaves the list
    markDeviceOffline(deviceId);

    const updates = {
        [`registered_devices/${deviceId}/controllerConnected`]: false,
        [`registered_devices/${deviceId}/isBlocked`]: false
    };

    return database.ref().update(updates)
        .then(() => {
            // 4. Remove from the active session list (offline count stays via sessionOfflineSet)
            const idx = connectedDevices.findIndex(d => d.id === deviceId);
            if (idx !== -1) connectedDevices.splice(idx, 1);
            delete deviceStatusMap[deviceId];

            if (connectedDeviceId === deviceId) {
                if (connectedDevices.length > 0) {
                    switchActiveDevice(connectedDevices[0].id);
                } else {
                    connectedDeviceId = null;
                    isDeviceBlocked   = false;
                    updateConnectionUI(false);
                }
            }

            updateDeviceListUI();
            updateDeviceCounts();
        })
        .catch(e => {
            console.error('disconnectSingleDevice error:', e);
            const idx = connectedDevices.findIndex(d => d.id === deviceId);
            if (idx !== -1) connectedDevices.splice(idx, 1);
            delete deviceStatusMap[deviceId];
            updateDeviceListUI();
            updateDeviceCounts();
        });
}

// ═══════════════════════════════════════
//  BLOCK / UNBLOCK
// ═══════════════════════════════════════

function blockAllDevices() {
    Promise.all(connectedDevices.map(d =>
        database.ref(`registered_devices/${d.id}/isBlocked`).set(true)
    )).then(() => {
        connectedDevices.forEach(d => d.isBlocked = true);
        isDeviceBlocked = true;
        updateBlockUI(true);
        updateDeviceListUI();
    }).catch(e => alert('Error blocking devices: ' + e.message));
}

function unblockAllDevices() {
    Promise.all(connectedDevices.map(d =>
        database.ref(`registered_devices/${d.id}/isBlocked`).set(false)
    )).then(() => {
        connectedDevices.forEach(d => d.isBlocked = false);
        isDeviceBlocked = false;
        updateBlockUI(false);
        updateDeviceListUI();
    }).catch(e => alert('Error unblocking devices: ' + e.message));
}

function toggleDeviceBlock(deviceId, blockState) {
    database.ref(`registered_devices/${deviceId}/isBlocked`).set(blockState)
        .then(() => {
            const idx = connectedDevices.findIndex(d => d.id === deviceId);
            if (idx !== -1) {
                connectedDevices[idx].isBlocked = blockState;
                updateDeviceListUI();
                if (connectedDeviceId === deviceId) {
                    isDeviceBlocked = blockState;
                    updateBlockUI(blockState);
                }
            }
        })
        .catch(e => alert('Error changing block state: ' + e.message));
}

// ═══════════════════════════════════════
//  UI UPDATES
// ═══════════════════════════════════════

function updateConnectionStatus(isConnected) {
    if (!statusIndicator) return;
    statusIndicator.className = isConnected
        ? 'status-badge status-connected'
        : 'status-badge status-disconnected';
    statusIndicator.innerHTML = `<span class="status-dot"></span>
        <span class="status-label">${isConnected ? 'Connected' : 'Disconnected'}</span>`;
}

function updateConnectionUI(isConnected) {
    updateConnectionStatus(isConnected);
    deviceInfo.classList.toggle('hidden', !isConnected);
    controlPanel.classList.toggle('hidden', !isConnected);
}

function updateBlockUI(isBlocked) {
    if (blockStatusDisplay) {
        blockStatusDisplay.textContent = isBlocked ? 'Blocked' : 'Unblocked';
        blockStatusDisplay.style.color = isBlocked ? 'var(--red-bright)' : 'var(--green-bright)';
    }
    if (blockButton)   blockButton.disabled   = isBlocked;
    if (unblockButton) unblockButton.disabled = !isBlocked;
}

/**
 * Recount connected vs offline devices from deviceStatusMap.
 * Connected   = device is in the list AND its status is 'online'
 * Offline     = device is in the list AND its status is 'offline'
 */
function updateDeviceCounts() {
    // Online  = devices currently in the session that are still connected
    const online = connectedDevices.filter(d => deviceStatusMap[d.id] === 'online').length;

    // Offline = any device that went offline this session, tracked independently
    // so the count survives even after the device is removed from connectedDevices
    const offline = sessionOfflineSet.size;

    const connectedEl = document.getElementById('connectedCount');
    const offlineEl   = document.getElementById('offlineCount');

    if (connectedEl) connectedEl.textContent = online;
    if (offlineEl)   offlineEl.textContent   = offline;
}

// Best-effort guess at WHY a device went offline so the log says
// something more useful than just "Disconnected".
async function inferDisconnectReason(deviceId) {
    try {
        const snap = await database.ref(`registered_devices/${deviceId}`).once('value');
        const data = snap.val();

        // Node was removed from Firebase — that only happens when the user
        // taps Disconnect inside the app, OR the teacher disconnects them here.
        if (!data) return 'app removed the device (user tapped Disconnect or app uninstalled)';

        // Node still exists but controllerConnected dropped to false.
        // Use lastPing / lastHeartbeat to guess between "shut down" vs "no signal".
        const now  = Date.now();
        const last = data.lastHeartbeat || data.lastPing || 0;
        const gap  = last ? (now - last) : Infinity;

        if (gap > 60000) {
            return 'no signal — internet/data turned off, or device shut down';
        }
        return 'app went to background or lost foreground connection';
    } catch (e) {
        return 'connection lost';
    }
}

// Mark a device as offline. The row STAYS in the paired list — it just flips
// to an offline visual state. Keeping the row is what allows the heartbeat
// monitor to revive it automatically when the phone comes back online,
// without the user having to refresh the page.
function markDeviceOffline(deviceId) {
    if (deviceStatusMap[deviceId] === 'offline') return;

    deviceStatusMap[deviceId] = 'offline';
    sessionOfflineSet.add(deviceId);

    const device = connectedDevices.find(d => d.id === deviceId);
    if (device) device.online = false;

    // Snapshot identity so we can log under the right name AND dedupe
    // any future re-pairing under a different connection code.
    const snapshotInfo = {
        hardwareId:  device ? (device.hardwareId  || null) : null,
        userId:      device ? (device.userId      || null) : null,
        displayName: device ? (device.displayName || device.name || null) : null,
        removedAt:   Date.now()
    };

    if (deviceId === connectedDeviceId) updateConnectionStatus(false);

    // Render immediately so the card flips to grey/offline within the same tick.
    updateDeviceListUI();
    updateDeviceCounts();

    // Resolve the WHY asynchronously, then write the log entry.
    inferDisconnectReason(deviceId).then(reason => {
        snapshotInfo.reason = reason;
        _registerOfflineIdentity(deviceId, snapshotInfo);

        const displayName = snapshotInfo.displayName || `Device …${deviceId.substring(0, 8)}`;
        logConnectionEventNamed(displayName, Date.now(), 'disconnected', reason);
    });
}

// Mark a device as online — flips the row back to its normal styling and
// logs a reconnect (only if it had previously gone offline).
function markDeviceOnline(deviceId) {
    const wasOffline = deviceStatusMap[deviceId] === 'offline';

    deviceStatusMap[deviceId] = 'online';
    _clearOfflineIdentity(deviceId);

    const device = connectedDevices.find(d => d.id === deviceId);
    if (device) device.online = true;

    updateDeviceListUI();
    updateDeviceCounts();
    if (deviceId === connectedDeviceId) updateConnectionStatus(true);

    if (wasOffline) {
        logConnectionEvent(deviceId, Date.now(), 'reconnected');
    }
}

function updateDeviceStatusUI(deviceId, status) {
    const item = document.querySelector(`.device-item[data-device-id="${deviceId}"]`);
    if (!item) return;

    item.classList.remove('device-online', 'device-offline');
    item.classList.add(status === 'online' ? 'device-online' : 'device-offline');

    const dot = item.querySelector('.status-dot');
    if (dot) dot.style.background = status === 'online' ? 'var(--green-bright)' : 'var(--red-bright)';

    let offlineAlert = item.querySelector('.offline-alert');
    if (status === 'offline') {
        if (!offlineAlert) {
            offlineAlert = document.createElement('span');
            offlineAlert.className = 'offline-alert';
            offlineAlert.innerHTML = '<i class="fas fa-exclamation-circle"></i> Offline';
            const statusDiv = item.querySelector('.device-status');
            if (statusDiv) statusDiv.appendChild(offlineAlert);
        }
    } else {
        if (offlineAlert) offlineAlert.remove();
    }

    updateDeviceCounts();
}

function updateDeviceListUI() {
    deviceListContainer.innerHTML = '';

    if (connectedDevices.length === 0) {
        deviceListContainer.style.display = 'none';
        const addBtn = document.getElementById('addDeviceButton');
        if (addBtn) addBtn.style.display = 'none';
        return;
    }

    deviceListContainer.style.display = 'block';
    const addBtn = document.getElementById('addDeviceButton');
    if (addBtn) addBtn.style.display = 'flex';

    const header = document.createElement('div');
    header.className = 'device-list-header';
    header.textContent = `Paired Devices (${connectedDevices.length})`;
    deviceListContainer.appendChild(header);

    connectedDevices.forEach(device => {
        const item = document.createElement('div');
        item.className = 'device-item';
        item.setAttribute('data-device-id', device.id);
        if (device.id === connectedDeviceId) item.classList.add('active-device');
        item.classList.add(deviceStatusMap[device.id] === 'online' ? 'device-online' : 'device-offline');

        // Clickable info row
        const info = document.createElement('div');
        info.className = 'device-info-row';
        info.addEventListener('click', () => switchActiveDevice(device.id));

        const nameEl = document.createElement('div');
        nameEl.className = 'device-name';
        nameEl.textContent = device.displayName || device.deviceName || device.name || `Device ${device.id.substring(0, 8)}`;

        const idEl = document.createElement('div');
        idEl.className = 'device-id';
        idEl.textContent = `ID: ${device.id.substring(0, 12)}...`;

        info.appendChild(nameEl);
        info.appendChild(idEl);

        // Status row
        const statusDiv = document.createElement('div');
        statusDiv.className = 'device-status';

        const dot = document.createElement('span');
        dot.className = 'status-dot';
        dot.style.cssText = 'width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;';
        dot.style.background = deviceStatusMap[device.id] === 'online' ? 'var(--green-bright)' : 'var(--red-bright)';

        const statusText = document.createElement('span');
        statusText.style.fontSize = '12px';
        statusText.style.color = deviceStatusMap[device.id] === 'online' ? 'var(--green-bright)' : 'var(--red-bright)';
        statusText.textContent = deviceStatusMap[device.id] === 'online' ? 'Online' : 'Offline';

        statusDiv.appendChild(dot);
        statusDiv.appendChild(statusText);

        if (deviceStatusMap[device.id] === 'offline') {
            const alertBadge = document.createElement('span');
            alertBadge.className = 'offline-alert';
            alertBadge.innerHTML = '<i class="fas fa-exclamation-circle"></i> Offline';
            statusDiv.appendChild(alertBadge);
        }

        // Controls
        const controls = document.createElement('div');
        controls.className = 'device-controls';

        const blockBtn = document.createElement('button');
        blockBtn.className = 'btn btn-block';
        blockBtn.innerHTML = '<i class="fas fa-ban"></i> Block';
        blockBtn.disabled = device.isBlocked;
        blockBtn.addEventListener('click', () => toggleDeviceBlock(device.id, true));

        const unblockBtn = document.createElement('button');
        unblockBtn.className = 'btn btn-unblock';
        unblockBtn.innerHTML = '<i class="fas fa-unlock"></i> Unblock';
        unblockBtn.disabled = !device.isBlocked;
        unblockBtn.addEventListener('click', () => toggleDeviceBlock(device.id, false));

        const disconnBtn = document.createElement('button');
        disconnBtn.className = 'btn btn-disconnect';
        disconnBtn.innerHTML = '<i class="fas fa-power-off"></i> Disconnect';
        disconnBtn.addEventListener('click', () => disconnectSingleDevice(device.id));

        controls.appendChild(blockBtn);
        controls.appendChild(unblockBtn);
        controls.appendChild(disconnBtn);

        item.appendChild(info);
        item.appendChild(statusDiv);
        item.appendChild(controls);
        deviceListContainer.appendChild(item);
    });
}

// ═══════════════════════════════════════
//  DISCONNECTION / CONNECTION LOG
// ═══════════════════════════════════════

/**
 * Logs a connect or disconnect event.
 * Uses device.displayName (first + last name from app login) if available,
 * otherwise falls back to device.name, then a short ID.
 */
function logConnectionEvent(deviceId, timestamp, eventType, reason) {
    const device = connectedDevices.find(d => d.id === deviceId);

    const displayName = device
        ? (device.displayName || device.deviceName || device.name || `Device …${deviceId.substring(0, 8)}`)
        : (offlineDeviceInfo[deviceId] && offlineDeviceInfo[deviceId].displayName)
            || `Device …${deviceId.substring(0, 8)}`;

    logConnectionEventNamed(displayName, timestamp, eventType, reason);
}

// Same as logConnectionEvent but takes the display name directly. Used when
// the device has already been removed from connectedDevices (e.g. on offline).
function logConnectionEventNamed(displayName, timestamp, eventType, reason) {
    const logContainer = document.getElementById('disconnectionLog');
    if (!logContainer) return;

    const emptyMsg = logContainer.querySelector('.log-empty');
    if (emptyMsg) emptyMsg.remove();

    const date  = new Date(timestamp);
    const pad   = n => n.toString().padStart(2, '0');
    const timeStr = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} `
                  + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timeEl  = document.createElement('span');
    timeEl.className = 'log-time';
    timeEl.textContent = timeStr;

    const nameEl  = document.createElement('span');
    nameEl.className = 'log-device';
    nameEl.textContent = displayName;

    const eventEl = document.createElement('span');
    eventEl.className = `log-event ${eventType}`;
    let label;
    if      (eventType === 'disconnected') label = 'Disconnected';
    else if (eventType === 'reconnected')  label = 'Reconnected';
    else                                   label = 'Connected';
    eventEl.textContent = label;

    entry.appendChild(timeEl);
    entry.appendChild(nameEl);
    entry.appendChild(eventEl);

    if (reason) {
        const reasonEl = document.createElement('span');
        reasonEl.className = 'log-reason';
        reasonEl.style.cssText = 'margin-left:8px;font-size:12px;opacity:0.75;font-style:italic;';
        reasonEl.textContent = '— ' + reason;
        entry.appendChild(reasonEl);
    }

    logContainer.insertBefore(entry, logContainer.firstChild);

    // Keep log tidy — max 50 entries
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

// ═══════════════════════════════════════
//  MULTI-DEVICE SCANNING
// ═══════════════════════════════════════

function startMultiDeviceScanning() {
    if (!isCameraOn) {
        const select   = document.getElementById('cameraSelection');
        const deviceId = select && select.value ? select.value : null;
        startCamera(deviceId);
    }
}

// ═══════════════════════════════════════
//  ACTIVE DEVICE SWITCHING
// ═══════════════════════════════════════

function switchActiveDevice(deviceId) {
    const device = connectedDevices.find(d => d.id === deviceId);
    if (!device) return;

    connectedDeviceId = deviceId;
    if (deviceIdDisplay) {
        deviceIdDisplay.textContent = device.displayName || device.deviceName || device.name || deviceId;
    }
    isDeviceBlocked = device.isBlocked || false;
    updateBlockUI(isDeviceBlocked);
    updateDeviceListUI();
}

// ═══════════════════════════════════════
//  STATUS MONITORING
// ═══════════════════════════════════════

function startStatusMonitor() {
    window.statusMonitorInterval = setInterval(() => {
        if (connectedDevices.length === 0) return;
        connectedDevices.forEach(device => {
            database.ref(`registered_devices/${device.id}/controllerConnected`).once('value')
                .then(snap => {
                    const connected = snap.val();
                    if ((connected === false || connected === null) && deviceStatusMap[device.id] === 'online') {
                        markDeviceOffline(device.id);
                    } else if (connected === true && deviceStatusMap[device.id] === 'offline') {
                        markDeviceOnline(device.id);
                    }
                })
                .catch(e => console.error('Status monitor error:', e));
        });
    }, 15000);
}

function startHeartbeat() {
    window.heartbeatInterval = setInterval(() => {
        if (connectedDevices.length === 0) return;
        database.ref('.info/connected').once('value', snap => {
            if (snap.val() !== true) return;
            connectedDevices.forEach(device => {
                database.ref(`registered_devices/${device.id}/controllerConnected`).once('value')
                    .then(snap => {
                        const connected = snap.val();
                        if ((connected === false || connected === null) && deviceStatusMap[device.id] === 'online') {
                            markDeviceOffline(device.id);
                        } else if (connected === true && deviceStatusMap[device.id] === 'offline') {
                            markDeviceOnline(device.id);
                        }
                    })
                    .catch(e => console.error('Heartbeat error:', e));
            });
        });
    }, 30000);
}

// Detect offline based on STALE HEARTBEAT alone — no longer wait for
// Firebase's onDisconnect to flip controllerConnected (which can take 30–60s
// or, on some networks, never fires fast enough to be useful).
//
// The Android foreground service writes lastHeartbeat every ~15s. If we
// haven't seen one in 22s, treat the phone as offline. End-to-end the user
// will see the card flip to grey within ~25s of pulling data / shutting down.
function startHeartbeatMonitoring() {
    const POLL_MS    = 5_000;
    const STALE_MS   = 22_000;   // ~1.5 missed heartbeats — under 25 s end-to-end
    const GRACE_MS   = 20_000;   // wait this long after a fresh pair before judging

    window.heartbeatMonitorInterval = setInterval(() => {
        if (connectedDevices.length === 0) return;
        const now = Date.now();

        connectedDevices.slice().forEach(device => {
            database.ref(`registered_devices/${device.id}`).once('value')
                .then(snap => {
                    if (!snap.exists()) {
                        // Node was deleted (in-app Disconnect or teacher delete);
                        // treat as offline.
                        if (deviceStatusMap[device.id] === 'online') {
                            markDeviceOffline(device.id);
                        }
                        return;
                    }
                    const data = snap.val() || {};
                    const last = data.lastHeartbeat
                              || data.lastPing
                              || data.createdAt
                              || 0;
                    const age = last ? (now - last) : Infinity;

                    // If we've never seen a heartbeat AND the row is brand new,
                    // give the phone a moment to send its first one.
                    if (!data.lastHeartbeat && data.createdAt && (now - data.createdAt) < GRACE_MS) {
                        return;
                    }

                    if (age > STALE_MS) {
                        if (deviceStatusMap[device.id] === 'online') {
                            markDeviceOffline(device.id);
                        }
                    } else if (deviceStatusMap[device.id] === 'offline') {
                        markDeviceOnline(device.id);
                    }
                })
                .catch(e => console.error('Heartbeat monitor error:', e));
        });
    }, POLL_MS);
}

function startPeriodicStatusCheck() {
    window.statusCheckInterval = setInterval(() => {
        if (connectedDevices.length > 0) updateDeviceCounts();
    }, 5000);
}

// ═══════════════════════════════════════
//  FIRESTORE USER INFO
// ═══════════════════════════════════════

function getUserInfo(userId) {
    if (!userId || !firestore) return Promise.resolve(null);
    return firestore.collection('users').doc(userId).get()
        .then(doc => {
            if (!doc.exists) return null;
            const data = doc.data();
            return (data.firstName && data.lastName)
                ? { firstName: data.firstName, lastName: data.lastName }
                : null;
        })
        .catch(e => { console.error('Firestore user fetch error:', e); return null; });
}

function loadUserDataForDevices() {
    connectedDevices.forEach(device => {
        // Skip if name already resolved
        if (device.displayName) return;

        // Try all possible UID field names the Android app might use
        const uid = device.userId
                 || device.uid
                 || device.userUid
                 || device.user_id
                 || device.ownerId
                 || device.registeredBy
                 || null;

        if (!uid) {
            console.warn('[EduLock] loadUserDataForDevices: no UID for device', device.id);
            return;
        }

        firestore.collection('users').doc(uid).get()
            .then(doc => {
                if (!doc.exists) {
                    console.warn('[EduLock] No Firestore doc for uid:', uid);
                    return;
                }
                const data = doc.data();
                let name = '';
                if (data.firstName && data.lastName) {
                    name = `${data.firstName} ${data.lastName}`.trim();
                } else if (data.firstName) {
                    name = data.firstName;
                } else if (data.name) {
                    name = data.name;
                } else if (data.email) {
                    name = data.email.split('@')[0];
                }
                if (name) {
                    device.displayName = name;
                    device.userId = uid;
                    database.ref(`registered_devices/${device.id}`).update({ displayName: name });
                    updateDeviceListUI();
                    if (device.id === connectedDeviceId && deviceIdDisplay) {
                        deviceIdDisplay.textContent = name;
                    }
                }
            })
            .catch(e => console.error('loadUserData error:', e));
    });
}

// ═══════════════════════════════════════
//  PAGE LIFECYCLE
// ═══════════════════════════════════════

function handlePageRefresh() {
    const isRefreshing = sessionStorage.getItem('isRefreshing');
    if (isRefreshing) {
        const stored = sessionStorage.getItem('connectedDevices');
        if (stored) {
            try {
                JSON.parse(stored).forEach(id => {
                    connectToDevice(id).catch(e => console.error('Reconnect error:', e));
                });
            } catch (e) { console.error('Session parse error:', e); }
        }
        sessionStorage.removeItem('isRefreshing');
    }

    window.addEventListener('beforeunload', () => {
        if (connectedDevices && connectedDevices.length > 0) {
            sessionStorage.setItem('connectedDevices', JSON.stringify(connectedDevices.map(d => d.id)));
            sessionStorage.setItem('isRefreshing', 'true');
        }
    });
}

function setupPageUnloadHandler() {
    window.addEventListener('beforeunload', () => {
        if (!connectedDevices || !connectedDevices.length) return;
        const updates = {};
        connectedDevices.forEach(d => {
            updates[`registered_devices/${d.id}/controllerConnected`] = false;
            updates[`registered_devices/${d.id}/isBlocked`] = false;
        });
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('PATCH', `${firebaseConfig.databaseURL}/.json`, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(updates));
        } catch (e) { console.error('Unload sync error:', e); }
    });
}

function setupBrowserConnectivityMonitor() {
    window.addEventListener('online', () => {
        document.getElementById('browser-offline-alert')?.remove();
        setTimeout(updateDeviceCounts, 2000);
    });

    window.addEventListener('offline', () => {
        if (!document.getElementById('browser-offline-alert')) {
            const el = document.createElement('div');
            el.id = 'browser-offline-alert';
            el.className = 'browser-offline-alert';
            el.innerHTML = '<i class="fas fa-wifi"></i> Your internet connection is offline. Device status may be inaccurate.';
            document.body.insertBefore(el, document.body.firstChild);
        }
    });
}

// ═══════════════════════════════════════
//  PAIRING CODE (URL param)
// ═══════════════════════════════════════

function handlePairingCode(code) {
    database.ref(`registered_devices/${code}`).once('value')
        .then(snap => {
            if (!snap.exists()) throw new Error('Invalid pairing code');
            if (snap.val().controllerConnected) throw new Error('Device already connected');
            if (pairingSection) pairingSection.classList.remove('hidden');
            if (pairingCodeDisplay) pairingCodeDisplay.textContent = code;
            if (pairButton) pairButton.addEventListener('click', () => connectToDevice(code));
        })
        .catch(e => {
            console.error('Pairing code error:', e);
            alert('Invalid or expired pairing code.');
        });
}
