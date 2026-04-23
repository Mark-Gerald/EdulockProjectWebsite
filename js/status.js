function startStatusMonitor() { }
function startHeartbeat()     { }

function startHeartbeatMonitoring() {
    const POLL_MS  = 5_000;
    const STALE_MS = 22_000;
    const GRACE_MS = 20_000;

    window.heartbeatMonitorInterval = setInterval(() => {
        if (connectedDevices.length === 0) return;
        const now = Date.now();

        connectedDevices.slice().forEach(device => {
            if (manuallyDisconnectedIds.has(device.id)) return;
            database.ref(`registered_devices/${device.id}`).once('value')
                .then(snap => {
                    if (!snap.exists()) {
                        if (deviceStatusMap[device.id] === 'online') {
                            markDeviceOffline(device.id);
                        }
                        return;
                    }
                    const data = snap.val() || {};

                    if (!data.lastHeartbeat && data.createdAt && (now - data.createdAt) < GRACE_MS) {
                        return;
                    }

                    const last = data.lastHeartbeat || 0;
                    const age = last ? (now - last) : Infinity;

                    if (age > STALE_MS) {
                        if (deviceStatusMap[device.id] === 'online') {
                            markDeviceOffline(device.id);
                        }
                    } else if (deviceStatusMap[device.id] === 'offline') {
                        if (data.controllerConnected === true) {
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

        if (!data) return 'app removed the device (user tapped Disconnect or app uninstalled)';

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

function markDeviceOffline(deviceId) {
    if (deviceStatusMap[deviceId] === 'offline') return;

    deviceStatusMap[deviceId] = 'offline';
    sessionOfflineSet.add(deviceId);

    const device = connectedDevices.find(d => d.id === deviceId);
    if (device) device.online = false;

    const snapshotInfo = {
        hardwareId:  device ? (device.hardwareId  || null) : null,
        userId:      device ? (device.userId      || null) : null,
        displayName: device ? (device.displayName || device.name || null) : null,
        removedAt:   Date.now()
    };

    if (deviceId === connectedDeviceId) updateConnectionStatus(false);

    updateDeviceListUI();
    updateDeviceCounts();

    inferDisconnectReason(deviceId).then(reason => {
        snapshotInfo.reason = reason;
        _registerOfflineIdentity(deviceId, snapshotInfo);

        const displayName = snapshotInfo.displayName || `Device …${deviceId.substring(0, 8)}`;
        logConnectionEventNamed(displayName, Date.now(), 'disconnected', reason);
    });
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
