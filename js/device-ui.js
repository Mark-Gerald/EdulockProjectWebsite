function updateConnectionStatus(isConnected) {
    if (!statusIndicator) return;
    statusIndicator.className = isConnected
        ? 'status-badge status-connected'
        : 'status-badge status-disconnected';
    statusIndicator.innerHTML = `<span class="status-dot"></span>
        <span class="status-label">${isConnected ? 'Connected' : 'Disconnected'}</span>`;
}

function updateConnectionUI(isConnected) {
    updateConnectionStatus(isConnected);
    deviceInfo.classList.toggle('hidden', !isConnected);
    controlPanel.classList.toggle('hidden', !isConnected);
}

function updateBlockUI(isBlocked) {
    if (blockStatusDisplay) {
        blockStatusDisplay.textContent = isBlocked ? 'Blocked' : 'Unblocked';
        blockStatusDisplay.style.color = isBlocked ? 'var(--red-bright)' : 'var(--green-bright)';
    }
    if (blockButton)   blockButton.disabled   = isBlocked;
    if (unblockButton) unblockButton.disabled = !isBlocked;
}

function updateDeviceCounts() {
    const online = connectedDevices.filter(d => deviceStatusMap[d.id] === 'online').length;
    const offline = sessionOfflineSet.size;

    const connectedEl = document.getElementById('connectedCount');
    const offlineEl   = document.getElementById('offlineCount');

    if (connectedEl) connectedEl.textContent = online;
    if (offlineEl)   offlineEl.textContent   = offline;
}

function updateDeviceStatusUI(deviceId, status) {
    const item = document.querySelector(`.device-item[data-device-id="${deviceId}"]`);
    if (!item) return;

    item.classList.remove('device-online', 'device-offline');
    item.classList.add(status === 'online' ? 'device-online' : 'device-offline');

    const dot = item.querySelector('.status-dot');
    if (dot) dot.style.background = status === 'online' ? 'var(--green-bright)' : 'var(--red-bright)';

    let offlineAlert = item.querySelector('.offline-alert');
    if (status === 'offline') {
        if (!offlineAlert) {
            offlineAlert = document.createElement('span');
            offlineAlert.className = 'offline-alert';
            offlineAlert.innerHTML = '<i class="fas fa-exclamation-circle"></i> Offline';
            const statusDiv = item.querySelector('.device-status');
            if (statusDiv) statusDiv.appendChild(offlineAlert);
        }
    } else {
        if (offlineAlert) offlineAlert.remove();
    }

    updateDeviceCounts();
}

function updateDeviceListUI() {
    if (dedupeConnectedDevicesByIdentity()) {
        updateDeviceCounts();
    }

    deviceListContainer.innerHTML = '';

    if (connectedDevices.length === 0) {
    deviceListContainer.style.display = 'none';
    const addBtn = document.getElementById('addDeviceButton');
    if (addBtn) addBtn.style.display = 'none';
    const searchWrapper = document.getElementById('deviceSearchWrapper');
    if (searchWrapper) searchWrapper.style.display = 'none';
    return;
}

    deviceListContainer.style.display = 'block';
const addBtn = document.getElementById('addDeviceButton');
if (addBtn) addBtn.style.display = 'flex';

// Show/hide search bar based on device count
const searchWrapper = document.getElementById('deviceSearchWrapper');
if (searchWrapper) {
    searchWrapper.style.display = connectedDevices.length > 0 ? 'block' : 'none';
}

// Clear search input when list is rebuilt so filter doesn't persist stale
const searchInput = document.getElementById('deviceSearchInput');
if (searchInput) searchInput.value = '';

const header = document.createElement('div');
header.className = 'device-list-header';
header.textContent = `Paired Devices (${connectedDevices.length})`;
deviceListContainer.appendChild(header);

    connectedDevices.forEach(device => {
        const item = document.createElement('div');
        item.className = 'device-item';
        item.setAttribute('data-device-id', device.id);
        if (device.id === connectedDeviceId) item.classList.add('active-device');
        item.classList.add(deviceStatusMap[device.id] === 'online' ? 'device-online' : 'device-offline');

        const info = document.createElement('div');
        info.className = 'device-info-row';
        info.addEventListener('click', () => switchActiveDevice(device.id));

        const nameEl = document.createElement('div');
        nameEl.className = 'device-name';
        nameEl.textContent = device.displayName || device.deviceName || device.name || `Device ${device.id.substring(0, 8)}`;

        const idEl = document.createElement('div');
        idEl.className = 'device-id';
        idEl.textContent = `ID: ${device.id.substring(0, 12)}...`;

        info.appendChild(nameEl);
        info.appendChild(idEl);

        const statusDiv = document.createElement('div');
        statusDiv.className = 'device-status';

        const dot = document.createElement('span');
        dot.className = 'status-dot';
        dot.style.cssText = 'width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;';
        dot.style.background = deviceStatusMap[device.id] === 'online' ? 'var(--green-bright)' : 'var(--red-bright)';

        const statusText = document.createElement('span');
        statusText.style.fontSize = '12px';
        statusText.style.color = deviceStatusMap[device.id] === 'online' ? 'var(--green-bright)' : 'var(--red-bright)';
        statusText.textContent = deviceStatusMap[device.id] === 'online' ? 'Online' : 'Offline';

        statusDiv.appendChild(dot);
        statusDiv.appendChild(statusText);

        if (deviceStatusMap[device.id] === 'offline') {
            const alertBadge = document.createElement('span');
            alertBadge.className = 'offline-alert';
            alertBadge.innerHTML = '<i class="fas fa-exclamation-circle"></i> Offline';
            statusDiv.appendChild(alertBadge);
        }

        const controls = document.createElement('div');
        controls.className = 'device-controls';

        const blockBtn = document.createElement('button');
        blockBtn.className = 'btn btn-block';
        blockBtn.innerHTML = '<i class="fas fa-ban"></i> Block';
        blockBtn.disabled = device.isBlocked;
        blockBtn.addEventListener('click', () => toggleDeviceBlock(device.id, true));

        const unblockBtn = document.createElement('button');
        unblockBtn.className = 'btn btn-unblock';
        unblockBtn.innerHTML = '<i class="fas fa-unlock"></i> Unblock';
        unblockBtn.disabled = !device.isBlocked;
        unblockBtn.addEventListener('click', () => toggleDeviceBlock(device.id, false));

        const disconnBtn = document.createElement('button');
        disconnBtn.className = 'btn btn-disconnect';
        disconnBtn.innerHTML = '<i class="fas fa-power-off"></i> Disconnect';
        disconnBtn.addEventListener('click', () => disconnectSingleDevice(device.id));

        controls.appendChild(blockBtn);
        controls.appendChild(unblockBtn);
        controls.appendChild(disconnBtn);

        item.appendChild(info);
        item.appendChild(statusDiv);
        item.appendChild(controls);
        deviceListContainer.appendChild(item);
    });
}

function filterDeviceList(query) {
    const items = document.querySelectorAll('#deviceList .device-item');
    //                                       ^^^^^^^^^ corrected
    const q = query.trim().toLowerCase();
    items.forEach(item => {
        const nameEl = item.querySelector('.device-name');
        const name = nameEl ? nameEl.textContent.toLowerCase() : '';
        item.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
}

function switchActiveDevice(deviceId) {
    const device = connectedDevices.find(d => d.id === deviceId);
    if (!device) return;

    connectedDeviceId = deviceId;
    if (deviceIdDisplay) {
        deviceIdDisplay.textContent = device.displayName || device.deviceName || device.name || deviceId;
    }
    isDeviceBlocked = device.isBlocked || false;
    updateBlockUI(isDeviceBlocked);
    updateDeviceListUI();
}
