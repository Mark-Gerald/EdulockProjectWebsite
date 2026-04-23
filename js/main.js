document.addEventListener('DOMContentLoaded', function () {
    const anchor = document.getElementById('deviceListAnchor');
    if (anchor) anchor.appendChild(deviceListContainer);

    document.getElementById('addDeviceButton')
        ?.addEventListener('click', startMultiDeviceScanning);

    if (blockButton)      blockButton.addEventListener('click', blockAllDevices);
    if (unblockButton)    unblockButton.addEventListener('click', unblockAllDevices);
    if (disconnectButton) disconnectButton.addEventListener('click', disconnectFromDevice);

    const qrEl = document.getElementById('qr-reader');
    if (qrEl) {
        try {
            html5QrCode = new Html5Qrcode('qr-reader');
        } catch (e) {
            console.error('QR scanner init error:', e);
        }
    }

    populateCameraList();

    database.ref('.info/connected').on('value', snap => {
        console.log('Firebase connected:', snap.val());
    });

    startStatusMonitor();
    startHeartbeat();
    startHeartbeatMonitoring();
    startPeriodicStatusCheck();
    setupBrowserConnectivityMonitor();
    handlePageRefresh();
    setupPageUnloadHandler();

    const urlParams   = new URLSearchParams(window.location.search);
    const pairingCode = urlParams.get('code');
    if (pairingCode) handlePairingCode(pairingCode);

    setTimeout(loadUserDataForDevices, 2000);

    console.log('EduLock Ready');
});

function startMultiDeviceScanning() {
    if (!isCameraOn) {
        const select   = document.getElementById('cameraSelection');
        const deviceId = select && select.value ? select.value : null;
        startCamera(deviceId);
    }
}

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
