async function onQRCodeSuccess(decodedText) {
    console.log('QR code detected:', decodedText);

    try {
        if (html5QrCode && isCameraOn) {
            await html5QrCode.pause(true);
        }

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

        console.log('[EduLock] Device data from RTDB:', JSON.stringify(deviceData));

        // Guard: prevent the heartbeat monitor and any lingering presence
        // listeners from reacting to the controllerConnected:false write below.
        // Without this, the monitor sees false and flickers the device offline
        // for the 800ms window before connectToDevice marks it online again.
        manuallyDisconnectedIds.add(code);

        await database.ref(`registered_devices/${code}`).update({
            controllerConnected: false,
            isBlocked:           false
        });
        await new Promise(r => setTimeout(r, 800));

        // Remove guard just before connecting so normal monitoring resumes
        manuallyDisconnectedIds.delete(code);

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
                deviceData.userId      = uid;
                console.log('[EduLock] Resolved display name:', displayName);
            } else {
                console.warn('[EduLock] User UID found but no Firestore document at users/' + uid);
            }
        } else {
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
            }
        }

        await connectToDevice(code);

        if (html5QrCode && isCameraOn) {
            html5QrCode.resume();
        }

    } catch (err) {
        console.error('QR processing error:', err);

        // If we errored after adding to manuallyDisconnectedIds but before
        // deleting it, clean it up so the device isn't permanently ignored
        if (err && typeof code === 'string') {
            manuallyDisconnectedIds.delete(code);
        }

        alert('Connection error: ' + err.message);

        if (html5QrCode && isCameraOn) {
            try { html5QrCode.resume(); } catch (e) { restartCamera(); }
        }
    }
}