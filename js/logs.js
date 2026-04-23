function logConnectionEvent(deviceId, timestamp, eventType, reason) {
    const device = connectedDevices.find(d => d.id === deviceId);

    const displayName = device
        ? (device.displayName || device.deviceName || device.name || `Device …${deviceId.substring(0, 8)}`)
        : (offlineDeviceInfo[deviceId] && offlineDeviceInfo[deviceId].displayName)
            || `Device …${deviceId.substring(0, 8)}`;

    logConnectionEventNamed(displayName, timestamp, eventType, reason);
}

function logConnectionEventNamed(displayName, timestamp, eventType, reason) {
    const logContainer = document.getElementById('disconnectionLog');
    if (!logContainer) return;

    const emptyMsg = logContainer.querySelector('.log-empty');
    if (emptyMsg) emptyMsg.remove();

    const date  = new Date(timestamp);
    const pad   = n => n.toString().padStart(2, '0');
    const timeStr = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} `
                  + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timeEl  = document.createElement('span');
    timeEl.className = 'log-time';
    timeEl.textContent = timeStr;

    const nameEl  = document.createElement('span');
    nameEl.className = 'log-device';
    nameEl.textContent = displayName;

    const eventEl = document.createElement('span');
    eventEl.className = `log-event ${eventType}`;
    let label;
    if      (eventType === 'disconnected') label = 'Disconnected';
    else if (eventType === 'reconnected')  label = 'Reconnected';
    else                                   label = 'Connected';
    eventEl.textContent = label;

    entry.appendChild(timeEl);
    entry.appendChild(nameEl);
    entry.appendChild(eventEl);

    if (reason) {
        const reasonEl = document.createElement('span');
        reasonEl.className = 'log-reason';
        reasonEl.style.cssText = 'margin-left:8px;font-size:12px;opacity:0.75;font-style:italic;';
        reasonEl.textContent = '— ' + reason;
        entry.appendChild(reasonEl);
    }

    logContainer.insertBefore(entry, logContainer.firstChild);

    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}
