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
