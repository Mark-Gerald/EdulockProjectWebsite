function populateCameraList() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
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

function toggleCamera() {
    if (isCameraOn) {
        stopCamera();
    } else {
        const select   = document.getElementById('cameraSelection');
        const deviceId = select && select.value ? select.value : null;
        startCamera(deviceId);
    }
}

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
        () => { }
    ).then(() => {
        isCameraOn = true;
        if (placeholder) placeholder.style.display = 'none';

        if (toggleBtn) {
            toggleBtn.className = 'btn btn-camera-off';
            toggleBtn.innerHTML = '<i class="fas fa-video-slash"></i> Camera Off';
        }

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
