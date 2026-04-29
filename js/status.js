function startStatusMonitor() { }
function startHeartbeat()     { }

function startHeartbeatMonitoring() {
    const POLL_MS  = 5_000;   // check every 5 seconds
    const STALE_MS = 22_000;  // mark offline if no heartbeat for 22 seconds

    window.heartbeatMonitorInterval = setInterval(() => {
        if (connectedDevices.length === 0) return;
        const now = Date.now();

        connectedDevices.slice().forEach(device => {
            if (manuallyDisconnectedIds.has(device.id)) return;

            // Only read lastHeartbeat — this must be written by the device app.
            // We deliberately ignore lastPing (written by the controller) and
            // createdAt, because those never go stale and hide real offline state.
            database.ref(`registered_devices/${device.id}/lastHeartbeat`).once('value')
                .then(snap => {
                    // Guard again in case device was disconnected while awaiting
                    if (manuallyDisconnectedIds.has(device.id)) return;
                    if (!connectedDevices.some(d => d.id === device.id)) return;

                    const last = snap.val() || 0;
                    const age  = last ? (now - last) : Infinity;

                    if (age > STALE_MS) {
                        if (deviceStatusMap[device.id] === 'online') {
                            markDeviceOffline(device.id);
                        }
                    } else {
                        if (deviceStatusMap[device.id] === 'offline') {
                            markDeviceOnline(device.id);
                        }
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

async function inferDisconnectReason(deviceId) {
    try {
        const snap = await database.ref(`registered_devices/${deviceId}`).once('value');
        const data = snap.val();

        if (!data) return 'Student disconnected — app removed or uninstalled';

        const now  = Date.now();
        const last = data.lastHeartbeat || 0;
        const gap  = last ? (now - last) : Infinity;

        if (gap > 60000) {
            return 'Student disconnected — no signal (device off or internet lost)';
        }
        return 'Student disconnected — app closed or went to background';
    } catch (e) {
        return 'Student disconnected — reason unknown';
    }
}

function markDeviceOffline(deviceId) {
    if (deviceStatusMap[deviceId] === 'offline') return;

    deviceStatusMap[deviceId] = 'offline';
    sessionOfflineSet.add(deviceId);

    const device = connectedDevices.find(d => d.id === deviceId);
    if (device) device.online = false;

    // Capture whatever name we have right now
    const knownName = device
        ? (device.displayName || device.name || null)
        : null;

    const snapshotInfo = {
        hardwareId:  device ? (device.hardwareId || null) : null,
        userId:      device ? (device.userId     || null) : null,
        displayName: knownName,
        removedAt:   Date.now()
    };

    if (deviceId === connectedDeviceId) updateConnectionStatus(false);
    updateDeviceListUI();
    updateDeviceCounts();

    // Resolve the best possible display name, then log
    _resolveDisplayName(deviceId, device, knownName).then(resolvedName => {
        inferDisconnectReason(deviceId).then(reason => {
            snapshotInfo.displayName = resolvedName;
            snapshotInfo.reason = reason;
            _registerOfflineIdentity(deviceId, snapshotInfo);
            logConnectionEventNamed(resolvedName, Date.now(), 'disconnected', reason);
        });
    });
}

function _resolveDisplayName(deviceId, device, knownName) {
    // If we already have a name, use it immediately
    if (knownName) return Promise.resolve(knownName);

    // Try to get UID from local device object
    const uid = device
        ? (device.userId || device.uid || device.userUid || device.user_id || device.ownerId || null)
        : null;

    if (uid && firestore) {
        return firestore.collection('users').doc(uid).get()
            .then(doc => {
                if (!doc.exists) return `Device …${deviceId.substring(0, 8)}`;
                const data = doc.data();
                if (data.firstName && data.lastName) return `${data.firstName} ${data.lastName}`.trim();
                if (data.firstName) return data.firstName;
                if (data.name) return data.name;
                return `Device …${deviceId.substring(0, 8)}`;
            })
            .catch(() => `Device …${deviceId.substring(0, 8)}`);
    }

    // Last resort: read displayName directly from RTDB
    return database.ref(`registered_devices/${deviceId}/displayName`).once('value')
        .then(snap => snap.val() || `Device …${deviceId.substring(0, 8)}`)
        .catch(() => `Device …${deviceId.substring(0, 8)}`);
}

function markDeviceOnline(deviceId) {
    if (manuallyDisconnectedIds.has(deviceId)) return;
    if (!connectedDevices.some(d => d.id === deviceId)) return;

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