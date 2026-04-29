let html5QrCode = null;
let isCameraOn = false;

let connectedDevices = [];
let connectedDeviceId = null;
let isDeviceBlocked = false;
let deviceStatusMap = {};

let sessionOfflineSet = new Set();
let offlineDeviceInfo = {};
let offlineIdentityIndex = {};

// Tracks devices being manually disconnected so presence/heartbeat
// listeners ignore them during and after the disconnect process
let manuallyDisconnectedIds = new Set();

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

function _identityKeySet(d) {
    return new Set(_identityKeysFor(d));
}

function _collapseDuplicatesAgainst(keepId, info) {
    const keepKeys = new Set(_identityKeysFor(info));
    if (keepKeys.size === 0) return;

    for (let i = connectedDevices.length - 1; i >= 0; i--) {
        const d = connectedDevices[i];
        if (d.id === keepId) continue;

        const dKeys = _identityKeysFor(d);
        const hit   = dKeys.some(k => keepKeys.has(k));
        if (!hit) continue;

        try {
            database.ref(`registered_devices/${d.id}`).off();
            database.ref(`registered_devices/${d.id}/isBlocked`).off();
            database.ref(`registered_devices/${d.id}/controllerConnected`).off();
        } catch (e) { }
        database.ref(`registered_devices/${d.id}`).remove().catch(() => {});

        connectedDevices.splice(i, 1);
        delete deviceStatusMap[d.id];
        _clearOfflineIdentity(d.id);
        if (connectedDeviceId === d.id) connectedDeviceId = keepId;
    }
}

function dedupeConnectedDevicesByIdentity() {
    if (connectedDevices.length < 2) return false;

    const seen    = new Map();
    const dropIds = new Set();

    const ranked = connectedDevices.slice().sort((a, b) => {
        const aOn = deviceStatusMap[a.id] === 'online' ? 1 : 0;
        const bOn = deviceStatusMap[b.id] === 'online' ? 1 : 0;
        if (aOn !== bOn) return bOn - aOn;
        if (a.id === connectedDeviceId) return -1;
        if (b.id === connectedDeviceId) return  1;
        return 0;
    });

    for (const d of ranked) {
        const keys = _identityKeysFor(d);
        if (keys.length === 0) continue;

        const conflict = keys.find(k => seen.has(k) && seen.get(k) !== d.id);
        if (conflict) {
            dropIds.add(d.id);
        } else {
            keys.forEach(k => seen.set(k, d.id));
        }
    }

    if (dropIds.size === 0) return false;

    dropIds.forEach(id => {
        try {
            database.ref(`registered_devices/${id}`).off();
            database.ref(`registered_devices/${id}/isBlocked`).off();
            database.ref(`registered_devices/${id}/controllerConnected`).off();
        } catch (e) { }
        database.ref(`registered_devices/${id}`).remove().catch(() => {});

        const idx = connectedDevices.findIndex(x => x.id === id);
        if (idx !== -1) connectedDevices.splice(idx, 1);
        delete deviceStatusMap[id];
        _clearOfflineIdentity(id);
        if (connectedDeviceId === id) {
            connectedDeviceId = connectedDevices.length > 0 ? connectedDevices[0].id : null;
        }
    });

    return true;
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