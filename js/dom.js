const statusIndicator    = document.getElementById('statusIndicator');
const deviceInfo         = document.getElementById('deviceInfo');
const controlPanel       = document.getElementById('controlPanel');
const pairingSection     = document.getElementById('pairingSection');
const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
const deviceIdDisplay    = document.getElementById('deviceIdDisplay');
const blockStatusDisplay = document.getElementById('blockStatusDisplay');
const blockButton        = document.getElementById('blockButton');
const unblockButton      = document.getElementById('unblockButton');
const disconnectButton   = document.getElementById('disconnectButton');
const pairButton         = document.getElementById('pairButton');

const deviceListContainer = document.createElement('div');
deviceListContainer.id = 'deviceList';
deviceListContainer.className = 'device-list';
