function connectToDevice(deviceId) {
    return new Promise((resolve, reject) => {
        database.ref(`registered_devices/${deviceId}`).once('value')
            .then(snapshot => {
                if (!snapshot.exists()) { reject(new Error('Device not found')); return; }

                const deviceData = snapshot.val();

                const resolvedName = deviceData.displayName
                                  || deviceData.deviceName
                                  || deviceData.name
                                  || null;

                const resolvedUid = deviceData.userId
                                 || deviceData.uid
                                 || deviceData.userUid
                                 || deviceData.user_id
                                 || deviceData.ownerId
                                 || deviceData.registeredBy
                                 || deviceData.resolvedUserId
                                 || null;

                const resolvedHardwareId = deviceData.hardwareId
                                        || deviceData.androidId
                                        || null;

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
                    logConnectionEventNamed(
                        prev.displayName || resolvedName || `Device …${deviceId.substring(0, 8)}`,
                        Date.now(),
                        'reconnected'
                    );
                }

                _collapseDuplicatesAgainst(deviceId, {
                    hardwareId:  resolvedHardwareId,
                    userId:      resolvedUid,
                    displayName: resolvedName
                });

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

    const pingInterval = setInterval(() => {
        if (!connectedDevices.some(d => d.id === deviceId)) {
            clearInterval(pingInterval);
            return;
        }
        database.ref(`registered_devices/${deviceId}/lastPing`)
            .set(firebase.database.ServerValue.TIMESTAMP)
            .catch(e => console.error('Ping write error:', e));
    }, 10000);

    deviceStatusMap[deviceId + '_pingInterval'] = pingInterval;
}

function setupPresenceDetection(deviceId) {
    let initialFire = true;
    database.ref(`registered_devices/${deviceId}/controllerConnected`).on('value', snap => {
        if (initialFire) { initialFire = false; return}
        if (manuallyDisconnectedIds.has(deviceId)) return;

        const connected = snap.val();

        if ((connected === false || connected === null) && deviceStatusMap[deviceId] === 'online') {
            markDeviceOffline(deviceId);
        }
    });
}

function disconnectFromDevice() {
    const ids = connectedDevices.map(d => d.id);
    const promises = ids.map(id => disconnectSingleDevice(id));
    Promise.all(promises)
        .then(() => {
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
    manuallyDisconnectedIds.add(deviceId);

    database.ref(`registered_devices/${deviceId}`).off();
    database.ref(`registered_devices/${deviceId}/isBlocked`).off();
    database.ref(`registered_devices/${deviceId}/controllerConnected`).off();

    ['_pingInterval', '_interval'].forEach(suffix => {
        const key = deviceId + suffix;
        if (deviceStatusMap[key]) { clearInterval(deviceStatusMap[key]); delete deviceStatusMap[key]; }
    });

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

    const updates = {
        [`registered_devices/${deviceId}/controllerConnected`]: false,
        [`registered_devices/${deviceId}/isBlocked`]: false
    };

    return database.ref().update(updates)
        .then(() => {
            manuallyDisconnectedIds.delete(deviceId);
        })
        .catch(e => {
            console.error('disconnectSingleDevice error:', e);
            manuallyDisconnectedIds.delete(deviceId);
        });
}
