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
        if (device.displayName) return;

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
                    dedupeConnectedDevicesByIdentity();
                    updateDeviceListUI();
                    if (device.id === connectedDeviceId && deviceIdDisplay) {
                        deviceIdDisplay.textContent = name;
                    }
                }
            })
            .catch(e => console.error('loadUserData error:', e));
    });
}
