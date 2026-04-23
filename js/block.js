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
