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

    // Format timestamp
    const date    = new Date(timestamp);
    const pad     = n => n.toString().padStart(2, '0');
    const timeStr = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
                  + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

    // Event label
    let label;
    if      (eventType === 'disconnected') label = 'Disconnected';
    else if (eventType === 'reconnected')  label = 'Reconnected';
    else                                   label = 'Connected';

    // Sanitize values so empty strings show a fallback
    const safeName   = (displayName || '').trim() || 'Unknown device';
    const safeReason = (reason      || '').trim() || 'No additional detail';

    // ── Outer entry wrapper ───────────────────────────────────────
    const entry = document.createElement('div');
    entry.className = 'log-collapsible';

    // ── Summary row (always visible, clickable) ───────────────────
    const summary = document.createElement('div');
    summary.className = 'log-summary';
    summary.innerHTML = `
        <span class="log-time">${timeStr}</span>
        <span class="log-event ${eventType}">${label}</span>
        <span class="log-device">${safeName}</span>
        <span class="log-chevron"><i class="fas fa-chevron-down"></i></span>
    `;

    // ── Detail panel (hidden until expanded) ─────────────────────
    const detail = document.createElement('div');
    detail.className = 'log-detail';
    detail.innerHTML = `
        <div class="log-detail-row">
            <span class="log-detail-label"><i class="fas fa-user"></i> Student</span>
            <span class="log-detail-value">${safeName}</span>
        </div>
        <div class="log-detail-row">
            <span class="log-detail-label"><i class="fas fa-bolt"></i> Event</span>
            <span class="log-detail-value">${label}</span>
        </div>
        <div class="log-detail-row">
            <span class="log-detail-label"><i class="fas fa-clock"></i> Time</span>
            <span class="log-detail-value">${timeStr}</span>
        </div>
        <div class="log-detail-row">
            <span class="log-detail-label"><i class="fas fa-info-circle"></i> Reason</span>
            <span class="log-detail-value">${safeReason}</span>
        </div>
    `;

    // ── Toggle expand / collapse ──────────────────────────────────
    summary.addEventListener('click', () => {
        entry.classList.toggle('log-open');
    });

    entry.appendChild(summary);
    entry.appendChild(detail);
    logContainer.insertBefore(entry, logContainer.firstChild);

    // Cap log at 50 entries
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}