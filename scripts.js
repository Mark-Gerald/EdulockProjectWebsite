let database;
let html5QrCode = null;

const firebaseConfig = {
    apiKey: "AIzaSyBPyX-vMxXf-Wn4Rx9jKlHUWYWYWcxqpuM",
    authDomain: "edulock-register-firebase.firebaseapp.com",
    databaseURL: "https://edulock-register-firebase-default-rtdb.firebaseio.com",
    projectId: "edulock-register-firebase",
    storageBucket: "edulock-register-firebase.appspot.com",
    messagingSenderId: "1039430447528",
    appId: "1:1039430447528:web:c4f4514659a2a2c24d5e0c"
};

let connectedDevices = [];
let isScanning = false;
let firestore;

try {
    // Initialize Firestore
    firebase.initializeApp(firebaseConfig);
    firestore = firebase.firestore();
    console.log('Firestore initialized');
} catch (error) {
    console.error('Firestore initialization error:', error);
}

function getUserInfo(userId) {
    console.log("Fetching user info for userId:", userId);
    
    if (!userId) {
        console.error("Invalid userId provided");
        return Promise.resolve(null);
    }
    
    // Make sure Firestore is initialized
    if (!firebase.firestore) {
        console.error("Firestore not available");
        return Promise.resolve(null);
    }
    
    // Create Firestore instance if not already created
    if (!firestore) {
        firestore = firebase.firestore();
    }
    
    // Test if we can access Firestore
    return firestore.collection('users').doc(userId).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                console.log("User data retrieved:", userData);
                
                if (userData.firstName && userData.lastName) {
                    return {
                        firstName: userData.firstName,
                        lastName: userData.lastName
                    };
                } else {
                    console.warn("User document missing name fields:", userData);
                    return null;
                }
            } else {
                console.log("No user document found for ID:", userId);
                return null;
            }
        })
        .catch((error) => {
            console.error("Error getting user document:", error);
            return null;
        });
}

try {
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Get references to services
    database = firebase.database();
    
    // Initialize Firestore with merge option to prevent host override warning
    firestore = firebase.firestore();
    firestore.settings({ 
        merge: true 
    });
    
    console.log('Firebase services initialized');
    
    // Test database connection
    database.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            console.log('Connected to Firebase Realtime Database');
        } else {
            console.log('Not connected to Firebase Realtime Database');
        }
    });
    
    // Test Firestore connection and load user data
    firestore.collection('users').limit(1).get()
        .then(() => {
            console.log('Firestore connection verified');
            // Load user data for all connected devices
            setTimeout(loadUserDataForDevices, 1000);
        })
        .catch(error => {
            console.error('Firestore connection test failed:', error);
        });
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const pairingCode = urlParams.get('code');

let connectedDeviceId = null;
let isDeviceBlocked = false;

let onlineDeviceCount = 0;
let offlineDeviceCount = 0;
let deviceStatusMap = {};

// DOM elements
const statusIndicator = document.getElementById('statusIndicator');
const deviceInfo = document.getElementById('deviceInfo');
const controlPanel = document.getElementById('controlPanel');
const setupSection = document.getElementById('setupSection');
const pairingSection = document.getElementById('pairingSection');
const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
const deviceIdDisplay = document.getElementById('deviceIdDisplay');
const blockStatusDisplay = document.getElementById('blockStatusDisplay');
const blockButton = document.getElementById('blockButton');
const unblockButton = document.getElementById('unblockButton');
const disconnectButton = document.getElementById('disconnectButton');
const pairButton = document.getElementById('pairButton');

const deviceListContainer = document.createElement('div');
deviceListContainer.id = 'deviceList';
deviceListContainer.className = 'device-list';
deviceListContainer.style.color = '#000000';
deviceListContainer.style.backgroundColor = '#ffffff';
deviceListContainer.style.padding = '10px';
deviceListContainer.style.borderRadius = '8px';
deviceListContainer.style.marginTop = '15px';

const addDeviceButton = document.createElement('button');
addDeviceButton.id = 'addDeviceButton';
addDeviceButton.className = 'btn-add-device';
addDeviceButton.textContent = 'Add Another Device';
// Add matching styling
addDeviceButton.style.backgroundColor = '#8c52ff';
addDeviceButton.style.color = 'blue';
addDeviceButton.style.border = 'none';
addDeviceButton.style.borderRadius = '4px';
addDeviceButton.style.padding = '8px 16px';
addDeviceButton.style.margin = '10px auto';
addDeviceButton.style.cursor = 'pointer';
addDeviceButton.style.display = 'none';
addDeviceButton.style.display = 'block';
addDeviceButton.style.textAlign = 'center';
addDeviceButton.style.width = 'fit-content';
addDeviceButton.style.marginLeft = 'auto';
addDeviceButton.style.marginRight = 'auto';

const stopScanningButton = document.createElement('button');
stopScanningButton.id = 'stopScanningButton';
stopScanningButton.className = 'btn-stop-scanning';
stopScanningButton.textContent = 'Stop Scanning';
stopScanningButton.style.display = 'none';
stopScanningButton.style.backgroundColor = '#e74c3c';
stopScanningButton.style.color = 'white';
stopScanningButton.style.border = 'none';
stopScanningButton.style.borderRadius = '4px';
stopScanningButton.style.padding = '8px 16px';
stopScanningButton.style.margin = '10px 0';
stopScanningButton.style.cursor = 'pointer';

// Add these elements to the DOM after the existing elements are loaded
document.addEventListener('DOMContentLoaded', function() {
    const controlPanel = document.getElementById('controlPanel');
    if (controlPanel) {
        controlPanel.appendChild(deviceListContainer);
        
        // Check if the button already exists in HTML
        const existingAddDeviceButton = document.getElementById('addDeviceButton');
        if (!existingAddDeviceButton) {
            // Only add our programmatic button if it doesn't exist in HTML
            controlPanel.appendChild(addDeviceButton);
            // Add event listener to our programmatic button
            addDeviceButton.addEventListener('click', startMultiDeviceScanning);
        } else {
            // Add event listener to the existing HTML button
            existingAddDeviceButton.addEventListener('click', startMultiDeviceScanning);
        }
        
        controlPanel.appendChild(stopScanningButton);
    }

    const qrReaderElement = document.getElementById('qr-reader');
    if (qrReaderElement) {
        // Clear any existing content
        qrReaderElement.innerHTML = '';
        
        qrReaderElement.style.width = '100%';
        qrReaderElement.style.minHeight = '300px';
        qrReaderElement.style.border = '1px solid #8c52ff';
        qrReaderElement.style.borderRadius = '8px';
        qrReaderElement.style.overflow = 'hidden';
        qrReaderElement.style.backgroundColor = '#1a1a1a';
        qrReaderElement.style.position = 'relative'; // Important for video positioning
    }
    
    // Initialize the QR scanner
    try {
        html5QrCode = new Html5Qrcode("qr-reader");
        console.log("QR scanner initialized successfully");
        
        // Initialize camera access
        setTimeout(() => {
            initializeCamera();
        }, 500);
    } catch (error) {
        console.error("Error initializing QR scanner:", error);
        
        // Show error to user
        const errorMsg = document.createElement('div');
        errorMsg.textContent = 'QR scanner initialization error: ' + error.message;
        errorMsg.style.color = 'red';
        errorMsg.style.padding = '10px';
        qrReaderElement.appendChild(errorMsg);
    }

    addDeviceButton.addEventListener('click', startMultiDeviceScanning);
    stopScanningButton.addEventListener('click', stopMultiDeviceScanning);

    startStatusMonitor();
    updateDeviceCounts();
    startHeartbeat();
    startHeartbeatMonitoring();
    cleanupStaleConnections();
    startPeriodicStatusCheck();
    setupBrowserConnectivityMonitor();
    handlePageRefresh();
    setupPageUnloadHandler();
    setTimeout(loadUserDataForDevices, 2000);
});

function initializeCamera() {
    console.log("Initializing camera with improved error handling...");
    
    // Create an error display element if it doesn't exist
    let errorDisplay = document.getElementById('camera-error-display');
    if (!errorDisplay) {
        errorDisplay = document.createElement('div');
        errorDisplay.id = 'camera-error-display';
        errorDisplay.style.color = '#e74c3c';
        errorDisplay.style.backgroundColor = 'rgba(231, 76, 60, 0.2)';
        errorDisplay.style.padding = '10px';
        errorDisplay.style.borderRadius = '5px';
        errorDisplay.style.margin = '10px 0';
        errorDisplay.style.display = 'none';
        
        const qrReader = document.getElementById('qr-reader');
        if (qrReader && qrReader.parentElement) {
            qrReader.parentElement.insertBefore(errorDisplay, qrReader);
        }
    }
    
    // Request camera permissions with better error handling
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
            // Release the stream immediately
            stream.getTracks().forEach(track => track.stop());
            
            // Hide any previous errors
            errorDisplay.style.display = 'none';
            
            // Now get the camera list
            return Html5Qrcode.getCameras();
        })
        .then(devices => {
            if (devices && devices.length) {
                console.log("Found cameras:", devices.length);
                
                // Check if camera selection already exists
                let cameraSelection = document.getElementById('cameraSelection');
                
                // If it doesn't exist, create it
                if (!cameraSelection) {
                    cameraSelection = document.createElement('select');
                    cameraSelection.id = 'cameraSelection';
                    cameraSelection.className = 'camera-select';
                    
                    // Add styling
                    cameraSelection.style.margin = '10px 0';
                    cameraSelection.style.padding = '8px';
                    cameraSelection.style.borderRadius = '4px';
                    cameraSelection.style.backgroundColor = '#3a2a5e';
                    cameraSelection.style.color = 'white';
                    cameraSelection.style.border = '1px solid #8c52ff';
                    cameraSelection.style.width = '100%';
                    
                    const qrReader = document.getElementById('qr-reader');
                    if (qrReader && qrReader.parentElement) {
                        qrReader.parentElement.insertBefore(
                            cameraSelection, 
                            qrReader
                        );
                    }
                } else {
                    // Clear existing options
                    cameraSelection.innerHTML = '';
                }
                
                // Add camera options
                devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.id;
                    option.text = device.label || `Camera ${devices.indexOf(device) + 1}`;
                    cameraSelection.appendChild(option);
                });
                
                // Add event listener for camera selection
                cameraSelection.addEventListener('change', function() {
                    const selectedDeviceId = this.value;
                    if (html5QrCode && html5QrCode.isScanning) {
                        html5QrCode.stop().then(() => {
                            startQRScanner(selectedDeviceId);
                        }).catch(err => {
                            console.error("Error stopping scanner:", err);
                            startQRScanner(selectedDeviceId);
                        });
                    } else {
                        startQRScanner(selectedDeviceId);
                    }
                });
                
                // Start scanner with the first camera
                if (devices.length > 0) {
                    startQRScanner(devices[0].id);
                }
            } else {
                // No cameras found
                errorDisplay.textContent = 'No cameras found on your device. Please ensure you have a camera connected.';
                errorDisplay.style.display = 'block';
                console.error("No cameras found");
            }
        })
        .catch(error => {
            console.error("Camera access error:", error);
            
            // Show user-friendly error message
            let errorMessage = 'Error accessing camera: ';
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += 'Camera permission denied. Please allow camera access in your browser settings.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No camera found on your device.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage += 'Your camera is in use by another application.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage += 'No suitable camera found.';
            } else {
                errorMessage += error.message || 'Unknown error';
            }
            
            errorDisplay.textContent = errorMessage;
            errorDisplay.style.display = 'block';
        });
}

function startQRScanner(deviceId) {
    console.log("Starting QR scanner with device ID:", deviceId);
    
    // Stop any existing scanner
    const stopScannerPromise = html5QrCode && html5QrCode.isScanning ? 
        html5QrCode.stop().catch(err => {
            console.error("Error stopping scanner:", err);
        }) : 
        Promise.resolve();
    
    stopScannerPromise.finally(() => {
        // Clear any previous error messages
        const errorElement = document.getElementById('qr-reader-error');
        if (errorElement) {
            errorElement.remove();
        }
        
        // Make sure the QR reader is visible
        const qrReader = document.getElementById('qr-reader');
        if (qrReader) {
            qrReader.style.opacity = '1';
            
            // Add a loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'camera-loading';
            loadingIndicator.textContent = 'Starting camera...';
            loadingIndicator.style.color = 'white';
            loadingIndicator.style.padding = '10px';
            loadingIndicator.style.textAlign = 'center';
            qrReader.appendChild(loadingIndicator);
            
            // Use more flexible constraints to avoid OverconstrainedError
            const config = { 
                fps: 10,
                qrbox: { width: 200, height: 200 },
                aspectRatio: 1.0,
                formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
            };
            
            // Only add device ID constraint, avoid width/height constraints
            const cameraConfig = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" };
            
            // Make sure to set proper styling for the video element
            setTimeout(() => {
                const videoElement = qrReader.querySelector('video');
                if (videoElement) {
                    videoElement.style.width = '100%';
                    videoElement.style.height = 'auto';
                    videoElement.style.objectFit = 'cover';
                    videoElement.style.display = 'block'; // Ensure it's visible
                }
            }, 1000);
            
            html5QrCode.start(
                cameraConfig,
                config,
                (decodedText) => {
                    console.log("QR Code detected:", decodedText);
                    
                    // Validate QR code format before processing
                    if (isValidQRCode(decodedText)) {
                        onQRCodeSuccess(decodedText);
                    } else {
                        // Show invalid QR code error
                        showQRError("Invalid QR code format. Please scan a valid EduLock QR code.");
                        
                        // Continue scanning
                        setTimeout(() => {
                            const errorMsg = document.getElementById('qr-reader-error');
                            if (errorMsg) {
                                errorMsg.remove();
                            }
                        }, 3000);
                    }
                },
                (error) => {
                    // Silent handling for normal scanning errors
                }
            ).then(() => {
                // Camera started successfully
                const loadingElement = document.getElementById('camera-loading');
                if (loadingElement) {
                    loadingElement.remove();
                }

                const videoElement = qrReader.querySelector('video');
                if (videoElement) {
                    videoElement.style.width = '100%';
                    videoElement.style.height = 'auto';
                    videoElement.style.objectFit = 'cover';
                    videoElement.style.display = 'block'; // Ensure it's visible
                }

            }).catch(err => {
                console.error("Scanner start error:", err);
                
                // Remove loading indicator
                const loadingElement = document.getElementById('camera-loading');
                if (loadingElement) {
                    loadingElement.remove();
                }
                
                // Show error message to user
                showQRError('Camera error: ' + err.message);
                
                // If we get an OverconstrainedError, try again with default constraints
                if (err.name === 'OverconstrainedError') {
                    const retryButton = document.createElement('button');
                    retryButton.textContent = 'Try with Default Camera';
                    retryButton.style.backgroundColor = '#8c52ff';
                    retryButton.style.color = 'white';
                    retryButton.style.border = 'none';
                    retryButton.style.borderRadius = '4px';
                    retryButton.style.padding = '8px 16px';
                    retryButton.style.margin = '10px 0';
                    retryButton.style.cursor = 'pointer';
                    
                    retryButton.addEventListener('click', () => {
                        startQRScanner(null); // Try with default camera
                    });
                    
                    const errorElement = document.getElementById('qr-reader-error');
                    if (errorElement) {
                        errorElement.appendChild(retryButton);
                    }
                }
            });
        }
    });
}

function isValidQRCode(qrCode) {
    // Check if the QR code is a valid device ID format
    return qrCode && qrCode.length >= 10 && qrCode.length <= 50;
}

function showQRError(message) {
    const qrReader = document.getElementById('qr-reader');
    if (!qrReader) return;
    
    // Remove any existing error
    const existingError = document.getElementById('qr-reader-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Create new error message
    const errorMsg = document.createElement('div');
    errorMsg.id = 'qr-reader-error';
    errorMsg.textContent = message;
    errorMsg.style.color = 'white';
    errorMsg.style.backgroundColor = 'rgba(231, 76, 60, 0.7)';
    errorMsg.style.padding = '10px';
    errorMsg.style.borderRadius = '5px';
    errorMsg.style.margin = '10px 0';
    errorMsg.style.textAlign = 'center';
    errorMsg.style.fontWeight = 'bold';
    
    qrReader.parentElement.appendChild(errorMsg);
}

function connectToDevice(deviceId) {
    console.log(`Connecting to device: ${deviceId}`);
    
    return new Promise((resolve, reject) => {
        // Check if device exists
        database.ref(`registered_devices/${deviceId}`).once('value')
            .then(snapshot => {
                if (!snapshot.exists()) {
                    console.error(`Device ${deviceId} not found`);
                    reject(new Error('Device not found'));
                    return;
                }
                
                // Get device data
                const deviceData = snapshot.val();
                console.log(`Device data:`, deviceData);
                
                // Update UI to show connected
                updateConnectionStatus(true);
                
                // If we have a userId, try to get the user's name from Firestore
                if (deviceData.userId) {
                    db.collection('users').doc(deviceData.userId).get()
                        .then((doc) => {
                            if (doc.exists) {
                                const userData = doc.data();
                                console.log(`Found user data for device ${deviceId}:`, userData);
                                
                                // Create display name from firstName and lastName or use email
                                let displayName = '';
                                if (userData.firstName && userData.lastName) {
                                    displayName = `${userData.firstName} ${userData.lastName}`;
                                } else if (userData.name) {
                                    displayName = userData.name;
                                } else if (userData.email) {
                                    displayName = userData.email.split('@')[0]; // Use part before @ in email
                                } else if (userData.username) {
                                    displayName = userData.username;
                                }
                                
                                if (displayName) {
                                    console.log(`Setting display name for device ${deviceId}: ${displayName}`);
                                    
                                    // Update the device record with the display name
                                    database.ref(`registered_devices/${deviceId}`).update({
                                        displayName: displayName
                                    });
                                    
                                    // Update device info display
                                    deviceIdDisplay.textContent = displayName;
                                    
                                    // Update the device in our list
                                    const deviceIndex = connectedDevices.findIndex(d => d.id === deviceId);
                                    if (deviceIndex !== -1) {
                                        connectedDevices[deviceIndex].displayName = displayName;
                                        updateDeviceListUI();
                                    }
                                }
                            }
                        })
                        .catch((error) => {
                            console.error(`Error getting user data:`, error);
                        });
                }
                
                // Update device info display - use displayName if available
                deviceIdDisplay.textContent = deviceData.displayName || deviceData.name || deviceId.substring(0, 8);
                
                // Show device info and control panel
                deviceInfo.classList.remove('hidden');
                controlPanel.classList.remove('hidden');
                
                // Hide setup section
                setupSection.classList.add('hidden');
                
                // Set connected device ID
                connectedDeviceId = deviceId;
                
                // Check if device is already in the list
                const existingDeviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
                
                if (existingDeviceIndex === -1) {
                    // Add to connected devices list
                    connectedDevices.push({
                        id: deviceId,
                        name: deviceData.name || `Device ${deviceId.substring(0, 8)}`,
                        displayName: deviceData.displayName || null,
                        isBlocked: deviceData.isBlocked || false,
                        online: true,
                        userId: deviceData.userId || null
                    });
                } else {
                    // Update existing device
                    connectedDevices[existingDeviceIndex].isBlocked = deviceData.isBlocked || false;
                    connectedDevices[existingDeviceIndex].online = true;
                    connectedDevices[existingDeviceIndex].displayName = deviceData.displayName || null;
                    connectedDevices[existingDeviceIndex].userId = deviceData.userId || null;
                }
                
                // Update block status
                isDeviceBlocked = deviceData.isBlocked || false;
                updateBlockUI(isDeviceBlocked);
                
                // Setup device listeners
                setupDeviceListeners(deviceId);
                
                // Setup presence detection for this device
                setupPresenceDetection(deviceId);
                
                // Set device status in the map
                deviceStatusMap[deviceId] = 'online';
                
                // Update device list UI
                updateDeviceListUI();
                
                // Update device counts
                updateDeviceCounts();
                
                // Show add device button
                if (addDeviceButton) {
                    addDeviceButton.style.display = 'block';
                }
                
                // Mark the device as connected in Firebase
                database.ref(`registered_devices/${deviceId}/controllerConnected`).set(true)
                    .then(() => {
                        console.log(`Device ${deviceId} marked as connected in Firebase`);
                    })
                    .catch(error => {
                        console.error(`Error marking device ${deviceId} as connected:`, error);
                    });
                
                resolve(deviceData);
            })
            .catch(error => {
                console.error(`Error connecting to device ${deviceId}:`, error);
                reject(error);
            });
    });
}

function completeConnection(deviceId, deviceData, resolve) {
    // Update UI to show connected
    updateConnectionStatus(true);
    
    // Update device info display - use displayName if available
    deviceIdDisplay.textContent = deviceData.displayName || deviceData.name || deviceId.substring(0, 8);
    
    // Show device info and control panel
    deviceInfo.classList.remove('hidden');
    controlPanel.classList.remove('hidden');
    
    // Hide setup section
    setupSection.classList.add('hidden');
    
    // Set connected device ID
    connectedDeviceId = deviceId;
    
    // Check if device is already in the list
    const existingDeviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
    
    if (existingDeviceIndex === -1) {
        // Add to connected devices list
        connectedDevices.push({
            id: deviceId,
            name: deviceData.name || `Device ${deviceId.substring(0, 8)}`,
            displayName: deviceData.displayName || null,
            isBlocked: deviceData.isBlocked || false,
            online: true,
            userId: deviceData.userId || null
        });
    } else {
        // Update existing device
        connectedDevices[existingDeviceIndex].isBlocked = deviceData.isBlocked || false;
        connectedDevices[existingDeviceIndex].online = true;
        connectedDevices[existingDeviceIndex].displayName = deviceData.displayName || null;
    }
    
    // Update block status
    isDeviceBlocked = deviceData.isBlocked || false;
    updateBlockUI(isDeviceBlocked);
    
    // Setup device listeners
    setupDeviceListeners(deviceId);
    
    // Setup presence detection for this device
    setupPresenceDetection(deviceId);
    
    // Set device status in the map
    deviceStatusMap[deviceId] = 'online';
    
    // Update device list UI
    updateDeviceListUI();
    
    // Update device counts
    updateDeviceCounts();
    
    // Show add device button
    if (addDeviceButton) {
        addDeviceButton.style.display = 'block';
    }
    
    // Mark the device as connected in Firebase
    database.ref(`registered_devices/${deviceId}/controllerConnected`).set(true)
        .then(() => {
            console.log(`Device ${deviceId} marked as connected in Firebase`);
        })
        .catch(error => {
            console.error(`Error marking device ${deviceId} as connected:`, error);
        });
    
    resolve(deviceData);
}

function loadUserDataForDevices() {
    console.log("Loading user data for all connected devices");
    
    // Process each connected device
    connectedDevices.forEach(device => {
        if (device.userId) {
            console.log(`Fetching user data for device ${device.id} with userId ${device.userId}`);
            
            // Fetch user data from Firestore
            firestore.collection('users').doc(device.userId).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        console.log(`Found user data for device ${device.id}:`, userData);
                        
                        // Create display name from available fields
                        let displayName = '';
                        if (userData.firstName && userData.lastName) {
                            displayName = `${userData.firstName} ${userData.lastName}`;
                        } else if (userData.name) {
                            displayName = userData.name;
                        } else if (userData.email) {
                            displayName = userData.email.split('@')[0]; // Use part before @ in email
                        } else if (userData.username) {
                            displayName = userData.username;
                        }
                        
                        if (displayName) {
                            console.log(`Setting display name for device ${device.id}: ${displayName}`);
                            
                            // Update the device record with the display name
                            database.ref(`registered_devices/${device.id}`).update({
                                displayName: displayName
                            });
                            
                            // Update the device in our array
                            device.displayName = displayName;
                            
                            // Update UI to reflect the change immediately
                            updateDeviceListUI();
                            
                            // If this is the active device, update the main display
                            if (device.id === connectedDeviceId) {
                                deviceIdDisplay.textContent = displayName;
                            }
                        }
                    } else {
                        console.log(`No user data found for userId: ${device.userId}`);
                    }
                })
                .catch((error) => {
                    console.error(`Error getting user data:`, error);
                });
        }
    });
}

function startMultiDeviceScanning() {
    isScanning = true;
    setupSection.classList.remove('hidden');
    
    // Make sure the QR reader is visible and reset its state
    const qrReader = document.getElementById('qr-reader');
    qrReader.style.opacity = '1';
    qrReader.style.display = 'block';
    
    // Clear any existing messages
    const loadingMsg = document.getElementById('connecting-message');
    if (loadingMsg) loadingMsg.remove();
    
    const errorMsg = document.getElementById('qr-reader-error');
    if (errorMsg) errorMsg.remove();
    
    // Hide/show appropriate buttons
    addDeviceButton.style.display = 'none';
    stopScanningButton.style.display = 'block';
    
    // Get the current selected camera and restart the scanner
    const cameraSelection = document.getElementById('cameraSelection');
    if (cameraSelection && cameraSelection.value) {
        console.log("Found camera selection, using camera:", cameraSelection.value);
        
        // Check if scanner is running before trying to stop it
        let isCurrentlyScanning = false;
        try {
            isCurrentlyScanning = html5QrCode.getState() === Html5QrcodeScannerState.SCANNING;
        } catch (err) {
            console.log("Could not get scanner state, assuming not scanning");
        }
        
        // Only try to stop if it's actually running
        const stopPromise = isCurrentlyScanning ? 
            html5QrCode.stop().catch(err => {
                console.log("Error stopping scanner (ignored):", err);
            }) : 
            Promise.resolve();
            
        stopPromise.finally(() => {
            // Wait a moment before restarting
            setTimeout(() => {
                startScanner(cameraSelection.value);
                
                // Log to confirm scanner is restarting
                console.log("Restarting scanner for multi-device scanning");
            }, 500);
        });
    } else {
        console.log("No camera selected for multi-device scanning, trying to reinitialize");
        
        // Check if scanner is running before trying to stop it
        let isCurrentlyScanning = false;
        try {
            isCurrentlyScanning = html5QrCode.getState() === Html5QrcodeScannerState.SCANNING;
        } catch (err) {
            console.log("Could not get scanner state, assuming not scanning");
        }
        
        // Only try to stop if it's actually running
        const stopPromise = isCurrentlyScanning ? 
            html5QrCode.stop().catch(err => {
                console.log("Error stopping scanner (ignored):", err);
            }) : 
            Promise.resolve();
            
        stopPromise.finally(() => {
            // Then reinitialize the camera
            setTimeout(() => {
                // Force reinitialize camera with default settings
                Html5Qrcode.getCameras().then(devices => {
                    if (devices && devices.length) {
                        console.log("Found cameras on reinit:", devices.length);
                        startScanner(devices[0].id);
                    } else {
                        console.error("No cameras found on reinit");
                    }
                }).catch(err => {
                    console.error("Error getting cameras on reinit:", err);
                });
            }, 500);
        });
    }
}

function monitorDeviceStatus(deviceId) {
    console.log(`Starting to monitor device status for ${deviceId}`);
    
    // Initialize the device in our status map as online
    deviceStatusMap[deviceId] = 'online';
    updateDeviceCounts();
    
    // Listen for app-side connection status changes
    const appConnectionRef = database.ref(`registered_devices/${deviceId}/controllerConnected`);
    appConnectionRef.on('value', function(snapshot) {
        const isConnected = snapshot.val();
        console.log(`Device ${deviceId} connection status changed to: ${isConnected}`);
        
        // Update our status tracking
        if (isConnected === false && deviceStatusMap[deviceId] === 'online') {
            deviceStatusMap[deviceId] = 'offline';
            updateDeviceCounts();
            logDisconnectionEvent(deviceId, Date.now());
        } else if (isConnected === true && deviceStatusMap[deviceId] === 'offline') {
            deviceStatusMap[deviceId] = 'online';
            updateDeviceCounts();
        }
    });
}

function startHeartbeatMonitoring() {
    // Clear any existing monitoring
    if (window.heartbeatMonitorInterval) {
        clearInterval(window.heartbeatMonitorInterval);
    }
    
    // Set up a new monitor that runs every 30 seconds (less frequent to reduce false positives)
    window.heartbeatMonitorInterval = setInterval(() => {
        // Skip if no devices are connected
        if (connectedDevices.length === 0) return;
        
        console.log("Checking device heartbeats");
        
        const now = Date.now();
        const timeoutThreshold = 60000; // 60 seconds (more lenient timeout)
        
        // Check each device's last heartbeat
        connectedDevices.forEach(device => {
            // Skip manual disconnects
            if (deviceStatusMap[device.id + '_manualDisconnect']) {
                return;
            }
            
            database.ref(`registered_devices/${device.id}/lastHeartbeat`).once('value')
                .then(snapshot => {
                    const lastHeartbeat = snapshot.val();
                    
                    if (!lastHeartbeat) {
                        // No heartbeat recorded, check connection status first
                        return database.ref(`registered_devices/${device.id}/controllerConnected`).once('value')
                            .then(connSnapshot => {
                                const isConnected = connSnapshot.val();
                                
                                // Only mark as offline if Firebase also says it's disconnected
                                if (isConnected === false && deviceStatusMap[device.id] === 'online') {
                                    console.log(`No heartbeat and Firebase says disconnected for device ${device.id}`);
                                    updateDeviceStatusUI(device.id, 'offline', 'heartbeat-timeout');
                                    logDisconnectionEvent(device.id, now);
                                }
                            });
                    }
                    
                    const timeSinceHeartbeat = now - lastHeartbeat;
                    
                    if (timeSinceHeartbeat > timeoutThreshold) {
                        // Double-check with Firebase connection status
                        return database.ref(`registered_devices/${device.id}/controllerConnected`).once('value')
                            .then(connSnapshot => {
                                const isConnected = connSnapshot.val();
                                
                                // Only mark as offline if both heartbeat is old AND Firebase says disconnected
                                if (isConnected === false && deviceStatusMap[device.id] === 'online') {
                                    console.log(`Heartbeat timeout and Firebase says disconnected for device ${device.id}`);
                                    updateDeviceStatusUI(device.id, 'offline', 'heartbeat-timeout');
                                    logDisconnectionEvent(device.id, now);
                                }
                            });
                    } else {
                        // Recent heartbeat, consider online
                        if (deviceStatusMap[device.id] !== 'online') {
                            console.log(`Recent heartbeat for device ${device.id}, marking as online`);
                            updateDeviceStatusUI(device.id, 'online');
                        }
                    }
                })
                .catch(error => {
                    console.error(`Error checking heartbeat for device ${device.id}:`, error);
                });
        });
    }, 30000); // Check every 30 seconds
}

// Update the disconnectFromDevice function to avoid permission issues
function disconnectFromDevice() {
    console.log("Disconnecting from all devices");
    
    // Disconnect all devices
    const disconnectPromises = connectedDevices.map(device => {
        return disconnectSingleDevice(device.id);
    });
    
    Promise.all(disconnectPromises)
        .then(() => {
            console.log("All devices disconnected successfully");
            
            // Reset local state
            connectedDevices = [];
            connectedDeviceId = null;
            isDeviceBlocked = false;
            
            // Update UI
            updateConnectionUI(false);
            updateDeviceListUI();
            
            // Restart the scanner
            setTimeout(restartScanner, 500);
        })
        .catch(error => {
            console.error("Error disconnecting devices:", error);
            alert('Error disconnecting devices: ' + error.message);
            
            // Even if there's an error, reset the UI
            connectedDevices = [];
            connectedDeviceId = null;
            isDeviceBlocked = false;
            updateConnectionUI(false);
            updateDeviceListUI();
            setTimeout(restartScanner, 500);
        });
}

function disconnectDevice(deviceId) {
    console.log(`Disconnecting device: ${deviceId}`);
    
    // First, ALWAYS unblock the device before disconnecting
    database.ref(`registered_devices/${deviceId}/blocked`).set(false)
        .then(() => {
            console.log(`Device ${deviceId} unblocked successfully`);
            
            // Then mark as disconnected
            return database.ref(`registered_devices/${deviceId}/controllerConnected`).set(false);
        })
        .then(() => {
            console.log(`Device ${deviceId} marked as disconnected`);
            
            // Force update our local status map
            deviceStatusMap[deviceId] = 'offline';
            
            // Force update the UI immediately
            updateDeviceStatusUI(deviceId, 'offline');
            
            // Log the disconnection event
            logDisconnectionEvent(deviceId, Date.now());
            
            // Force update device counts immediately
            let online = 0;
            let offline = 0;
            
            // Count devices based on our updated status map
            for (const id in deviceStatusMap) {
                if (deviceStatusMap[id] === 'online') {
                    online++;
                } else if (deviceStatusMap[id] === 'offline') {
                    offline++;
                }
            }
            
            // Update the UI with the counts
            const connectedCountElement = document.getElementById('connectedCount');
            const offlineCountElement = document.getElementById('offlineCount');
            
            if (connectedCountElement) {
                connectedCountElement.textContent = online.toString();
            }
            
            if (offlineCountElement) {
                offlineCountElement.textContent = offline.toString();
            }
            
            console.log(`Updated device counts - Online: ${online}, Offline: ${offline}`);
            
            // If this was the active device, reset the UI
            if (deviceId === connectedDeviceId) {
                // Reset connection status
                updateConnectionStatus(false);
                
                // Hide device info and control panel
                deviceInfo.classList.add('hidden');
                controlPanel.classList.add('hidden');
                
                // Show setup section
                setupSection.classList.remove('hidden');
                
                // Reset connected device ID
                connectedDeviceId = null;
            }
            
            // Keep the device in the list but mark as offline
            const deviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
            if (deviceIndex !== -1) {
                // Don't remove, just update status
                connectedDevices[deviceIndex].online = false;
            }
            
            // Update device list UI
            updateDeviceListUI();
            
            // Play offline notification
            playOfflineNotification();
        })
        .catch(error => {
            console.error(`Error disconnecting device ${deviceId}:`, error);
            alert(`Failed to disconnect device. Please try again.`);
        });
}

function cleanupStaleConnections() {
    console.log("Cleaning up stale device connections...");
    
    // Only attempt cleanup if we have connected devices
    if (!connectedDevices || connectedDevices.length === 0) {
        console.log("No connected devices to clean up");
        return;
    }
    
    // Instead of fetching all devices (which might cause permission issues),
    // only check the devices we know about
    const updates = {};
    
    connectedDevices.forEach(device => {
        // Check if this device is still connected
        database.ref(`registered_devices/${device.id}/controllerConnected`).once('value')
            .then(snapshot => {
                const isConnected = snapshot.val();
                
                // If Firebase says it's connected but our local state says it's not,
                // update Firebase to match our local state
                if (isConnected === true && deviceStatusMap[device.id] === 'offline') {
                    console.log(`Marking device ${device.id} as disconnected in Firebase`);
                    database.ref(`registered_devices/${device.id}/controllerConnected`).set(false)
                        .catch(error => {
                            console.error(`Error updating connection status for ${device.id}:`, error);
                        });
                }
            })
            .catch(error => {
                console.log(`Skipping cleanup for device ${device.id} due to permission error:`, error);
            });
    });
}

function setupPresenceDetection(deviceId) {
    console.log(`Setting up presence detection for device ${deviceId}`);
    
    // Create a reference to the device's connection status
    const deviceConnectionRef = database.ref(`registered_devices/${deviceId}`);
    
    // Set up a listener for the device connection status
    deviceConnectionRef.on('value', (snapshot) => {
        const deviceData = snapshot.val();
        if (!deviceData) return;
        
        // Update our local status tracking
        if (deviceData.controllerConnected === false) {
            deviceStatusMap[deviceId] = 'offline';
            updateDeviceStatusUI(deviceId, 'offline');
            updateDeviceCounts();
            
            // If the device is disconnected but still blocked, unblock it
            if (deviceData.blocked === true) {
                console.log(`Device ${deviceId} is disconnected but still blocked. Unblocking...`);
                database.ref(`registered_devices/${deviceId}/blocked`).set(false)
                    .then(() => {
                        console.log(`Device ${deviceId} unblocked after controller disconnection`);
                    })
                    .catch(error => {
                        console.error(`Error unblocking device ${deviceId}:`, error);
                    });
            }
        } else if (deviceData.controllerConnected === true) {
            deviceStatusMap[deviceId] = 'online';
            updateDeviceStatusUI(deviceId, 'online');
            updateDeviceCounts();
        }
    });
}

function updateDeviceCounts() {
    // Count online and offline devices
    const onlineDeviceCount = connectedDevices.filter(device => 
        deviceStatusMap[device.id] === 'online').length;
    
    const offlineDeviceCount = connectedDevices.filter(device => 
        deviceStatusMap[device.id] === 'offline').length;
    
    console.log(`Device counts updated - Online: ${onlineDeviceCount}, Offline: ${offlineDeviceCount}`);
    
    // Update UI if needed
    const onlineCountElement = document.getElementById('onlineCount');
    const offlineCountElement = document.getElementById('offlineCount');
    
    if (onlineCountElement) {
        onlineCountElement.textContent = onlineDeviceCount;
    }
    
    if (offlineCountElement) {
        offlineCountElement.textContent = offlineDeviceCount;
    }
}

function updateDeviceStatusUI(deviceId, status, reason = null) {
    console.log(`Updating UI for device ${deviceId} to ${status}${reason ? ` (Reason: ${reason})` : ''}`);
    
    const deviceElement = document.querySelector(`.device-item[data-device-id="${deviceId}"]`);
    if (!deviceElement) {
        console.log(`Device element for ${deviceId} not found in DOM`);
        return;
    }
    
    // If status hasn't changed, don't update UI
    if (deviceStatusMap[deviceId] === status) {
        console.log(`Device ${deviceId} status unchanged, skipping UI update`);
        return;
    }
    
    // Update our status map
    deviceStatusMap[deviceId] = status;
    
    // Remove existing status classes
    deviceElement.classList.remove('device-online', 'device-offline');
    
    // Add appropriate status class
    if (status === 'online') {
        deviceElement.classList.add('device-online');
        deviceElement.style.opacity = '1';
        
        // Remove offline alert if it exists
        const existingAlert = deviceElement.querySelector('.offline-alert');
        if (existingAlert) {
            existingAlert.remove();
        }
    } else if (status === 'offline') {
        deviceElement.classList.add('device-offline');
        deviceElement.style.opacity = '0.7';
        
        // Add offline alert if it doesn't exist
        if (!deviceElement.querySelector('.offline-alert')) {
            const offlineAlert = document.createElement('div');
            offlineAlert.className = 'offline-alert';
            offlineAlert.textContent = 'Device Offline';
            offlineAlert.style.color = '#e74c3c';
            offlineAlert.style.fontWeight = 'bold';
            offlineAlert.style.padding = '5px';
            offlineAlert.style.marginTop = '5px';
            offlineAlert.style.backgroundColor = 'rgba(231, 76, 60, 0.2)';
            offlineAlert.style.borderRadius = '4px';
            deviceElement.appendChild(offlineAlert);
            
            // Only play notification sound if appropriate
            if (shouldPlayNotificationSound(deviceId, reason)) {
                playOfflineNotification();
            }
        }
    }
    
    // Update device counts after status change
    updateDeviceCounts();
}

function startPeriodicStatusCheck() {
    // Clear any existing interval
    if (window.statusCheckInterval) {
        clearInterval(window.statusCheckInterval);
    }
    
    // Set up a new interval that runs every 5 seconds
    window.statusCheckInterval = setInterval(() => {
        if (connectedDevices.length > 0) {
            console.log("Running periodic status check");
            updateDeviceCounts();
        }
    }, 5000); // Check every 5 seconds
}

function handlePageRefresh() {
    // Check if we have a session storage item indicating we're refreshing
    const isRefreshing = sessionStorage.getItem('isRefreshing');
    
    if (isRefreshing) {
        // We're coming back from a refresh, try to reconnect to devices
        console.log("Page was refreshed, attempting to reconnect to devices");
        
        // Get the devices we were connected to before refresh
        const storedDevices = sessionStorage.getItem('connectedDevices');
        if (storedDevices) {
            try {
                const devices = JSON.parse(storedDevices);
                
                // Reconnect to each device
                devices.forEach(deviceId => {
                    console.log(`Attempting to reconnect to device ${deviceId}`);
                    connectToDevice(deviceId).catch(error => {
                        console.error(`Failed to reconnect to device ${deviceId}:`, error);
                    });
                });
            } catch (error) {
                console.error("Error parsing stored devices:", error);
            }
        }
        
        // Clear the refresh flag
        sessionStorage.removeItem('isRefreshing');
    }
    
    // Set up event listener for future refreshes
    window.addEventListener('beforeunload', function(event) {
        // Only set the flag if we have connected devices
        if (connectedDevices && connectedDevices.length > 0) {
            // Store the connected device IDs
            const deviceIds = connectedDevices.map(device => device.id);
            sessionStorage.setItem('connectedDevices', JSON.stringify(deviceIds));
            
            // Set the refreshing flag
            sessionStorage.setItem('isRefreshing', 'true');
            
            // No need to return anything, we're just setting up for the refresh
        }
    });
}

function updateCountUI(online, offline) {
    const connectedCountElement = document.getElementById('connectedCount');
    const offlineCountElement = document.getElementById('offlineCount');
    
    if (connectedCountElement) {
        connectedCountElement.textContent = online;
    }
    
    if (offlineCountElement) {
        offlineCountElement.textContent = offline;
    }
}

window.addEventListener('beforeunload', function() {
    // Mark all devices as disconnected when the browser closes
    if (connectedDevices && connectedDevices.length > 0) {
        const updates = {};
        
        connectedDevices.forEach(device => {
            updates[`registered_devices/${device.id}/controllerConnected`] = false;
            updates[`registered_devices/${device.id}/blocked`] = false;
        });
        
        // Use the synchronous version to ensure it completes before the page unloads
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', `${firebaseConfig.databaseURL}/registered_devices.json`, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(updates));
    }
});

function playOnlineNotification() {
    try {
        // Create an audio element with a different sound
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-positive-notification-951.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => {
            console.log("Could not play notification sound:", err);
        });
    } catch (err) {
        console.log("Error playing notification sound:", err);
    }
}

function updateDeviceStatusUI(deviceId, status) {
    console.log(`Updating UI for device ${deviceId} status: ${status}`);
    
    // Find the device item in the DOM
    const deviceItem = document.querySelector(`.device-item[data-device-id="${deviceId}"]`);
    if (!deviceItem) {
        console.log(`Device item for ${deviceId} not found in DOM`);
        return;
    }
    
    // Find the status indicator
    const statusIndicator = deviceItem.querySelector('.status-indicator');
    if (!statusIndicator) {
        console.log(`Status indicator for device ${deviceId} not found`);
        return;
    }
    
    // Update the status indicator class
    statusIndicator.classList.remove('status-connected', 'status-disconnected');
    statusIndicator.classList.add(status === 'online' ? 'status-connected' : 'status-disconnected');
    
    // Update the status text
    const statusText = statusIndicator.nextSibling;
    if (statusText) {
        statusText.textContent = status === 'online' ? 'Online' : 'Offline';
    }
    
    // Update the device in our list
    const deviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
    if (deviceIndex !== -1) {
        connectedDevices[deviceIndex].online = status === 'online';
        
        // If this is the active device, update the main UI
        if (connectedDeviceId === deviceId) {
            updateConnectionStatus(status === 'online');
        }
    }
}

function setupPageUnloadHandler() {
    window.addEventListener('beforeunload', function() {
        // Unblock and disconnect all devices when the browser closes
        if (connectedDevices && connectedDevices.length > 0) {
            const updates = {};
            
            connectedDevices.forEach(device => {
                updates[`registered_devices/${device.id}/controllerConnected`] = false;
                updates[`registered_devices/${device.id}/blocked`] = false;
            });
            
            // Use the synchronous version to ensure it completes before the page unloads
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('PATCH', `${firebaseConfig.databaseURL}/registered_devices.json`, false);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify(updates));
                console.log("Successfully unblocked all devices on page unload");
            } catch (e) {
                console.error("Error unblocking devices on page unload:", e);
            }
        }
    });
}

function playOfflineNotification() {
    // Check if we've played a notification recently
    const lastGlobalNotification = window._lastGlobalNotification || 0;
    const now = Date.now();
    
    // Only play one notification every 30 seconds globally
    if (now - lastGlobalNotification < 30000) {
        console.log('Skipping notification sound (played recently)');
        return;
    }
    
    // Update the last notification time
    window._lastGlobalNotification = now;
    
    try {
        // Check if we have the audio file
        const audio = new Audio('notification.mp3');
        audio.volume = 0.3; // Lower volume to 30%
        
        // Add event listeners to handle errors
        audio.addEventListener('error', (e) => {
            console.error('Error playing notification sound:', e);
        });
        
        // Play the sound
        audio.play().catch(e => {
            console.log('Error playing notification sound:', e);
        });
    } catch (e) {
        console.log('Error creating audio element:', e);
    }
}

function setupBrowserConnectivityMonitor() {
    // Listen for browser online/offline events
    window.addEventListener('online', function() {
        console.log("Browser is back online");
        
        // Reconnect to Firebase
        if (database) {
            // Force a refresh of device status
            setTimeout(() => {
                updateDeviceCounts();
            }, 2000);
        }
    });
    
    window.addEventListener('offline', function() {
        console.log("Browser is offline");
        
        // Update UI to show we're offline
        const offlineAlert = document.createElement('div');
        offlineAlert.id = 'browser-offline-alert';
        offlineAlert.className = 'browser-offline-alert';
        offlineAlert.innerHTML = '<i class="fas fa-wifi"></i> Your internet connection is offline. Device status may be inaccurate.';
        
        // Remove any existing alert first
        const existingAlert = document.getElementById('browser-offline-alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // Add the alert to the top of the page
        document.body.insertBefore(offlineAlert, document.body.firstChild);
    });
}

function logDisconnectionEvent(deviceId, timestamp) {
    console.log(`Logging disconnection event for device ${deviceId}`);
    
    // Get device name
    const device = connectedDevices.find(d => d.id === deviceId);
    const deviceName = device ? device.name : deviceId;
    
    // Create log entry
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    // Format timestamp
    const date = new Date(timestamp);
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    
    // Create timestamp element
    const timeElement = document.createElement('span');
    timeElement.className = 'log-time';
    timeElement.textContent = `${formattedDate} ${formattedTime}`;
    timeElement.style.color = '#8c52ff';
    
    // Create message element
    const messageElement = document.createElement('span');
    messageElement.className = 'log-message';
    messageElement.textContent = `Device ${deviceName} `;
    
    // Create status element
    const statusElement = document.createElement('span');
    statusElement.className = 'log-status disconnected';
    statusElement.textContent = 'Disconnected';
    statusElement.style.color = '#e74c3c';
    
    // Append elements to log entry
    logEntry.appendChild(timeElement);
    logEntry.appendChild(document.createTextNode(' '));
    logEntry.appendChild(messageElement);
    logEntry.appendChild(statusElement);
    
    // Get log container
    const logContainer = document.getElementById('disconnectionLog');
    if (logContainer) {
        // Add new entry at the top
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        // Limit log entries to 50
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }
}

// Call this function when a device is paired
function onDevicePaired(deviceId) {
    // Existing pairing code...
    
    // Start monitoring device status
    monitorDeviceStatus(deviceId)
}

function stopMultiDeviceScanning() {
    isScanning = false;
    setupSection.classList.add('hidden');
    addDeviceButton.style.display = 'block';
    stopScanningButton.style.display = 'none';
    
    html5QrCode.stop().catch(err => {
        console.error("Error stopping scanner:", err);
    });
}

    // Modify the startScanner function to better handle scanner state
    function startScanner(deviceId) {
        if (!html5QrCode) {
            console.error("QR scanner not initialized");
            return;
        }
    
        // Check if scanner is running before trying to stop it
        let isScanning = false;
        try {
            isScanning = html5QrCode.getState() === Html5QrcodeScannerState.SCANNING;
        } catch (err) {
            console.log("Could not get scanner state, assuming not scanning");
        }
        
        // Use a Promise to handle the scanner initialization
        const stopScannerPromise = isScanning ? 
            html5QrCode.stop().catch(err => {
                console.log("Scanner wasn't running, starting fresh");
            }) : 
            Promise.resolve();
        
        stopScannerPromise.finally(() => {
            // Clear any previous error messages
            const errorElement = document.getElementById('qr-reader-error');
            if (errorElement) {
                errorElement.remove();
            }
            
            // Make sure the QR reader is visible
            const qrReader = document.getElementById('qr-reader');
            if (qrReader) {
                qrReader.style.opacity = '1';
                
                // Add a loading indicator
                const loadingIndicator = document.createElement('div');
                loadingIndicator.id = 'camera-loading';
                loadingIndicator.textContent = 'Starting camera...';
                loadingIndicator.style.color = 'white';
                loadingIndicator.style.padding = '10px';
                loadingIndicator.style.textAlign = 'center';
                qrReader.appendChild(loadingIndicator);
                
                // Use more flexible constraints to avoid OverconstrainedError
                const config = { 
                    fps: 10,
                    qrbox: { width: 200, height: 200 },
                    aspectRatio: 1.0,
                    formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
                };
                
                // Only add device ID constraint, avoid width/height constraints
                const cameraConfig = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" };
                
                // Make sure to set proper styling for the video element
                setTimeout(() => {
                    const videoElement = qrReader.querySelector('video');
                    if (videoElement) {
                        videoElement.style.width = '100%';
                        videoElement.style.height = 'auto';
                        videoElement.style.objectFit = 'cover';
                        videoElement.style.display = 'block'; // Ensure it's visible
                    }
                }, 1000);
                
                html5QrCode.start(
                    cameraConfig,
                    config,
                    (decodedText) => {
                        console.log("QR Code detected:", decodedText);
                        onQRCodeSuccess(decodedText);
                    },
                    (error) => {
                        // Silent handling for normal scanning errors
                    }
                ).then(() => {
                    // Camera started successfully
                    const loadingElement = document.getElementById('camera-loading');
                    if (loadingElement) {
                        loadingElement.remove();
                    }
    
                    const videoElement = qrReader.querySelector('video');
                    if (videoElement) {
                        videoElement.style.width = '100%';
                        videoElement.style.height = 'auto';
                        videoElement.style.objectFit = 'cover';
                        videoElement.style.display = 'block'; // Ensure it's visible
                    }
    
                }).catch(err => {
                    console.error("Scanner start error:", err);
                    
                    // Remove loading indicator
                    const loadingElement = document.getElementById('camera-loading');
                    if (loadingElement) {
                        loadingElement.remove();
                    }
                    
                    // Show error message to user
                    const errorMsg = document.createElement('div');
                    errorMsg.id = 'qr-reader-error';
                    errorMsg.textContent = 'Camera error: ' + err.message;
                    errorMsg.style.color = 'red';
                    errorMsg.style.padding = '10px';
                    qrReader.parentElement.appendChild(errorMsg);
                    
                    // If we get an OverconstrainedError, try again with default constraints
                    if (err.name === 'OverconstrainedError') {
                        const retryButton = document.createElement('button');
                        retryButton.textContent = 'Try with Default Camera';
                        retryButton.style.backgroundColor = '#8c52ff';
                        retryButton.style.color = 'white';
                        retryButton.style.border = 'none';
                        retryButton.style.borderRadius = '4px';
                        retryButton.style.padding = '8px 16px';
                        retryButton.style.margin = '10px 0';
                        retryButton.style.cursor = 'pointer';
                        retryButton.addEventListener('click', () => {
                            // Try again with no specific device ID
                            startScanner(null);
                        });
                        qrReader.parentElement.appendChild(retryButton);
                    } else {
                        // For other errors, offer to try a different camera
                        const retryButton = document.createElement('button');
                        retryButton.textContent = 'Try Different Camera';
                        retryButton.style.backgroundColor = '#8c52ff';
                        retryButton.style.color = 'white';
                        retryButton.style.border = 'none';
                        retryButton.style.borderRadius = '4px';
                        retryButton.style.padding = '8px 16px';
                        retryButton.style.margin = '10px 0';
                        retryButton.style.cursor = 'pointer';
                        retryButton.addEventListener('click', () => {
                            // Re-initialize camera
                            initializeCamera();
                        });
                        qrReader.parentElement.appendChild(retryButton);
                    }
                });
            }
        });
    }

    // QR code success callback
    async function onQRCodeSuccess(decodedText) {
        console.log("Processing QR code:", decodedText);
        
        try {
            // Stop the scanner first
            await html5QrCode.stop();
            
            // Show connecting state
            document.getElementById('qr-reader').style.opacity = '0.5';
            const loadingMsg = document.createElement('div');
            loadingMsg.id = 'connecting-message';
            loadingMsg.textContent = 'Connecting to device...';
            document.getElementById('qr-reader').parentElement.appendChild(loadingMsg);
    
            // Check if the decoded text is just a code
            const code = decodedText.match(/^[0-9a-f-]+$/) ? 
                decodedText : 
                new URL(decodedText).searchParams.get('code');
    
            if (code) {
                // Check if device is already connected
                if (connectedDevices.some(device => device.id === code)) {
                    throw new Error('Device already connected');
                }
                
                // Check device connection status first
                const deviceRef = database.ref(`registered_devices/${code}`);
                const snapshot = await deviceRef.once('value');
                
                if (!snapshot.exists()) {
                    throw new Error('Device not found');
                }
    
                // Always force a clean connection state
                await deviceRef.update({
                    controllerConnected: false,
                    isBlocked: false
                });
                
                // Wait for disconnect to take effect
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Get device data
                const deviceData = snapshot.val();
                
                // If we have a userId, fetch the user info from Firestore
                if (deviceData.userId) {
                    console.log(`Device has userId: ${deviceData.userId}, fetching user info`);
                    const userData = await getUserInfo(deviceData.userId);
                    
                    if (userData) {
                        console.log(`User data found:`, userData);
                        // Create display name from firstName and lastName
                        const displayName = `${userData.firstName} ${userData.lastName}`;
                        
                        // Update the device record with the display name
                        await deviceRef.update({
                            displayName: displayName
                        });
                        
                        console.log(`Updated device with display name: ${displayName}`);
                        // Update local device data
                        deviceData.displayName = displayName;
                    }
                }
                
                // Now try to connect
                await connectToDevice(code);
                
                // If we're in multi-device scanning mode, restart the scanner
                if (isScanning) {
                    setTimeout(() => {
                        restartScanner();
                    }, 1000);
                }
            }
        } catch (error) {
            console.error("Error processing QR code:", error);
            alert('Connection error: ' + error.message);
            
            // Always restart scanner after error
            setTimeout(() => {
                restartScanner();
            }, 1000);
        }
    }

    function restartScanner() {
        console.log("Attempting to restart scanner");
        
        // Clear any existing messages
        const qrReader = document.getElementById('qr-reader');
        qrReader.style.opacity = '1';
        
        const loadingMsg = document.getElementById('connecting-message');
        if (loadingMsg) loadingMsg.remove();
        
        const errorMsg = document.getElementById('qr-reader-error');
        if (errorMsg) errorMsg.remove();
        
        // Get the current selected camera
        const cameraSelection = document.getElementById('cameraSelection');
        if (cameraSelection && cameraSelection.value) {
            console.log("Restarting scanner with camera:", cameraSelection.value);
            
            // First stop any existing scanner
            html5QrCode.stop().catch(() => {
                // Ignore errors when stopping
                console.log("Error stopping scanner (ignored)");
            }).finally(() => {
                // Wait a moment before restarting
                setTimeout(() => {
                    // Make sure the QR reader is visible
                    qrReader.style.display = 'block';
                    
                    startScanner(cameraSelection.value);
                    
                    // Force refresh the video element
                    setTimeout(() => {
                        const videoElement = qrReader.querySelector('video');
                        if (videoElement) {
                            videoElement.style.width = '100%';
                            videoElement.style.height = 'auto';
                            videoElement.style.objectFit = 'cover';
                            videoElement.style.display = 'block';
                            console.log("Video element refreshed");
                        } else {
                            console.log("Video element not found after restart");
                        }
                    }, 1000);
                }, 500);
            });
        } else {
            console.log("No camera selected for restart");
        }
    }

function onQRCodeError(error) {
    // Handle QR scan errors silently
    console.log("QR scan error:", error);
}

// If we have a pairing code, show it and enable pairing
if (pairingCode) {
    // First verify if the code is valid and device is ready
    database.ref(`registered_devices/${pairingCode}`).once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                throw new Error('Invalid pairing code');
            }
            
            // Check if device is already connected
            if (snapshot.val().controllerConnected) {
                throw new Error('Device already connected');
            }
            
            // Show pairing UI only after validation
            pairingSection.classList.remove('hidden');
            pairingCodeDisplay.textContent = pairingCode;
            
            // Set up pairing button
            pairButton.addEventListener('click', function() {
                connectToDevice(pairingCode);
            });
        })
        .catch((error) => {
            console.error("Pairing code error:", error);
            alert('Invalid or expired pairing code. Please try again.');
        });
}

function setupDeviceListeners(deviceId) {
    console.log(`Setting up listeners for device ${deviceId}`);
    
    // Listen for block status changes
    database.ref(`registered_devices/${deviceId}/isBlocked`).on('value', function(snapshot) {
        const isBlocked = snapshot.val();
        console.log(`Device ${deviceId} block status changed to: ${isBlocked}`);
        
        // Update our local tracking
        const deviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
        if (deviceIndex !== -1) {
            connectedDevices[deviceIndex].isBlocked = isBlocked;
        }
        
        // If this is the active device, update the UI
        if (deviceId === connectedDeviceId) {
            isDeviceBlocked = isBlocked;
            updateBlockUI(isBlocked);
        }
        
        // Update the device list UI
        updateDeviceListUI();
    });
    
    // Set up a ping mechanism to detect offline devices
    const pingInterval = setInterval(() => {
        if (!connectedDevices.some(device => device.id === deviceId)) {
            // Device no longer in our list, clear the interval
            clearInterval(pingInterval);
            return;
        }
        
        // Ping the device by updating a timestamp
        const pingRef = database.ref(`registered_devices/${deviceId}/lastPing`);
        pingRef.set(firebase.database.ServerValue.TIMESTAMP)
            .then(() => {
                console.log(`Ping sent to device ${deviceId}`);
                
                // Check if the device is responding by checking controllerConnected
                return database.ref(`registered_devices/${deviceId}/controllerConnected`).once('value');
            })
            .then(snapshot => {
                const isConnected = snapshot.val();
                
                // If Firebase says it's not connected, mark as offline
                if (isConnected === false) {
                    deviceStatusMap[deviceId] = 'offline';
                    updateDeviceStatusUI(deviceId, 'offline');
                    logDisconnectionEvent(deviceId, Date.now());
                } else {
                    deviceStatusMap[deviceId] = 'online';
                    updateDeviceStatusUI(deviceId, 'online');
                }
                
                // Update device counts
                updateDeviceCounts();
            })
            .catch(error => {
                console.error(`Error pinging device ${deviceId}:`, error);
                // Mark as offline on error
                deviceStatusMap[deviceId] = 'offline';
                updateDeviceStatusUI(deviceId, 'offline');
                updateDeviceCounts();
            });
    }, 10000); // Ping every 10 seconds
    
    // Store the interval ID for cleanup
    deviceStatusMap[deviceId + '_pingInterval'] = pingInterval;
}

function setupPresenceDetection(deviceId) {
    console.log(`Setting up presence detection for device ${deviceId}`);
    
    // Create a reference to the device's connection status
    const deviceConnectionRef = database.ref(`registered_devices/${deviceId}/controllerConnected`);
    
    // Set up a listener for the device connection status
    deviceConnectionRef.on('value', (snapshot) => {
        const isConnected = snapshot.val();
        console.log(`Device ${deviceId} connection status from Firebase: ${isConnected}`);
        
        // Update our local status tracking
        if (isConnected === false && deviceStatusMap[deviceId] === 'online') {
            console.log(`Device ${deviceId} is now offline (Firebase reported)`);
            deviceStatusMap[deviceId] = 'offline';
            updateDeviceStatusUI(deviceId, 'offline', 'connection-lost');
            logDisconnectionEvent(deviceId, Date.now());
            updateDeviceCounts();
        } else if (isConnected === true && deviceStatusMap[deviceId] === 'offline') {
            console.log(`Device ${deviceId} is now online (Firebase reported)`);
            deviceStatusMap[deviceId] = 'online';
            updateDeviceStatusUI(deviceId, 'online');
            updateDeviceCounts();
        }
    });
    
    // Also check for blocked status and unblock if disconnected
    database.ref(`registered_devices/${deviceId}`).on('value', (snapshot) => {
        const deviceData = snapshot.val();
        if (!deviceData) return;
        
        // If controller is disconnected but device is still blocked, unblock it
        if (deviceData.controllerConnected === false && deviceData.isBlocked === true) {
            console.log(`Device ${deviceId} is disconnected but still blocked. Unblocking...`);
            database.ref(`registered_devices/${deviceId}/isBlocked`).set(false)
                .then(() => {
                    console.log(`Device ${deviceId} unblocked after controller disconnection`);
                })
                .catch(error => {
                    console.error(`Error unblocking device ${deviceId}:`, error);
                });
        }
    });
}

// Replace the disconnectDevice function with this improved version
function disconnectDevice(deviceId) {
    console.log(`Disconnecting device: ${deviceId}`);
    
    // First, get the current state of the device
    database.ref(`registered_devices/${deviceId}`).once('value')
        .then((snapshot) => {
            const deviceData = snapshot.val();
            const isBlocked = deviceData && deviceData.isBlocked;
            
            // Create updates object to make atomic updates
            const updates = {};
            
            // Always set controllerConnected to false
            updates[`registered_devices/${deviceId}/controllerConnected`] = false;
            
            // If device is blocked, unblock it
            if (isBlocked) {
                updates[`registered_devices/${deviceId}/isBlocked`] = false;
                console.log(`Device ${deviceId} was blocked, unblocking during disconnect`);
            }
            
            // Apply all updates atomically
            return database.ref().update(updates);
        })
        .then(() => {
            console.log(`Device ${deviceId} disconnected and unblocked if needed`);
            
            // Update device status in our local map
            deviceStatusMap[deviceId] = 'offline';
            
            // Update the UI
            updateDeviceStatusUI(deviceId, 'offline');
            
            // Log the disconnection event
            logDisconnectionEvent(deviceId, Date.now());
            
            // Update device counts
            updateDeviceCounts();
            
            // If this was the active device, reset the UI
            if (deviceId === connectedDeviceId) {
                // Reset connection status
                updateConnectionStatus(false);
                
                // Hide device info and control panel
                deviceInfo.classList.add('hidden');
                controlPanel.classList.add('hidden');
                
                // Show setup section
                setupSection.classList.remove('hidden');
                
                // Reset connected device ID
                connectedDeviceId = null;
            }
            
            // Update the device in our list but mark as offline
            const deviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
            if (deviceIndex !== -1) {
                connectedDevices[deviceIndex].online = false;
                connectedDevices[deviceIndex].isBlocked = false; // Also update blocked status
            }
            
            // Update device list UI
            updateDeviceListUI();
        })
        .catch(error => {
            console.error(`Error disconnecting device ${deviceId}:`, error);
        });
}

window.addEventListener('beforeunload', function(event) {
    // Mark all devices as disconnected when the browser closes
    if (connectedDevices && connectedDevices.length > 0) {
        // Create a synchronous request to update Firebase
        const xhr = new XMLHttpRequest();
        const updates = {};
        
        connectedDevices.forEach(device => {
            updates[`registered_devices/${device.id}/controllerConnected`] = false;
        });
        
        // Convert updates to JSON
        const jsonData = JSON.stringify(updates);
        
        // Send synchronous request to Firebase
        xhr.open('PATCH', `${firebaseConfig.databaseURL}/.json`, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(jsonData);
        
        console.log('Marked all devices as disconnected on page unload');
    }
});

function startStatusMonitor() {
    // Clear any existing monitor
    if (window.statusMonitorInterval) {
        clearInterval(window.statusMonitorInterval);
    }
    
    // Set up a new monitor that runs every 15 seconds
    window.statusMonitorInterval = setInterval(() => {
        // Skip if no devices are connected
        if (connectedDevices.length === 0) return;
        
        console.log("Running status check for all connected devices");
        
        // Check each device's status
        connectedDevices.forEach(device => {
            database.ref(`registered_devices/${device.id}/controllerConnected`).once('value')
                .then(snapshot => {
                    const isConnected = snapshot.val();
                    
                    // Update our local status tracking
                    if (isConnected === false && deviceStatusMap[device.id] === 'online') {
                        console.log(`Status monitor detected device ${device.id} is offline`);
                        deviceStatusMap[device.id] = 'offline';
                        updateDeviceStatusUI(device.id, 'offline');
                        logDisconnectionEvent(device.id, Date.now());
                    } else if (isConnected === true && deviceStatusMap[device.id] === 'offline') {
                        console.log(`Status monitor detected device ${device.id} is back online`);
                        deviceStatusMap[device.id] = 'online';
                        updateDeviceStatusUI(device.id, 'online');
                    }
                })
                .catch(error => {
                    console.error(`Status check error for device ${device.id}:`, error);
                });
        });
        
        // Update device counts
        updateDeviceCounts();
    }, 15000);
}

function updateConnectionStatus(isConnected) {
    console.log(`Updating connection status: ${isConnected}`);
    
    if (statusIndicator) {
        // Remove existing classes
        statusIndicator.classList.remove('status-connected', 'status-disconnected');
        
        // Add appropriate class
        if (isConnected) {
            statusIndicator.classList.add('status-connected');
            statusIndicator.textContent = 'Connected';
        } else {
            statusIndicator.classList.add('status-disconnected');
            statusIndicator.textContent = 'Disconnected';
        }
    }
    
    // Update device info and control panel visibility
    if (deviceInfo && controlPanel && setupSection) {
        if (isConnected) {
            deviceInfo.classList.remove('hidden');
            controlPanel.classList.remove('hidden');
            setupSection.classList.add('hidden');
        } else {
            deviceInfo.classList.add('hidden');
            controlPanel.classList.add('hidden');
            setupSection.classList.remove('hidden');
        }
    }
}

// Function to connect to a device
function connectToDevice(deviceId) {
    console.log(`Connecting to device: ${deviceId}`);
    
    return new Promise((resolve, reject) => {
        // Check if device exists
        database.ref(`registered_devices/${deviceId}`).once('value')
            .then(snapshot => {
                if (!snapshot.exists()) {
                    console.error(`Device ${deviceId} not found`);
                    reject(new Error('Device not found'));
                    return;
                }
                
                // Get device data
                const deviceData = snapshot.val();
                console.log(`Device data:`, deviceData);
                
                // Update UI to show connected
                updateConnectionStatus(true);
                
                // Update device info display - use displayName if available
                deviceIdDisplay.textContent = deviceData.displayName || deviceData.name || deviceId.substring(0, 8);
                
                // Show device info and control panel
                deviceInfo.classList.remove('hidden');
                controlPanel.classList.remove('hidden');
                
                // Hide setup section
                setupSection.classList.add('hidden');
                
                // Set connected device ID
                connectedDeviceId = deviceId;
                
                // Check if device is already in the list
                const existingDeviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
                
                if (existingDeviceIndex === -1) {
                    // Add to connected devices list
                    connectedDevices.push({
                        id: deviceId,
                        name: deviceData.name || `Device ${deviceId.substring(0, 8)}`,
                        displayName: deviceData.displayName || null,
                        isBlocked: deviceData.isBlocked || false,
                        online: true,
                        userId: deviceData.userId || null
                    });
                } else {
                    // Update existing device
                    connectedDevices[existingDeviceIndex].isBlocked = deviceData.isBlocked || false;
                    connectedDevices[existingDeviceIndex].online = true;
                    connectedDevices[existingDeviceIndex].displayName = deviceData.displayName || null;
                    connectedDevices[existingDeviceIndex].userId = deviceData.userId || null;
                }
                
                // Update block status
                isDeviceBlocked = deviceData.isBlocked || false;
                updateBlockUI(isDeviceBlocked);
                
                // Setup device listeners
                setupDeviceListeners(deviceId);
                
                // Setup presence detection for this device
                setupPresenceDetection(deviceId);
                
                // Set device status in the map
                deviceStatusMap[deviceId] = 'online';
                
                // Update device list UI
                updateDeviceListUI();
                
                // Update device counts
                updateDeviceCounts();
                
                // Show add device button
                if (addDeviceButton) {
                    addDeviceButton.style.display = 'block';
                }
                
                // Mark the device as connected in Firebase
                database.ref(`registered_devices/${deviceId}/controllerConnected`).set(true)
                    .then(() => {
                        console.log(`Device ${deviceId} marked as connected in Firebase`);
                    })
                    .catch(error => {
                        console.error(`Error marking device ${deviceId} as connected:`, error);
                    });
                
                resolve(deviceData);
            })
            .catch(error => {
                console.error(`Error connecting to device ${deviceId}:`, error);
                reject(error);
            });
    });
}

function updateBlockUI(isBlocked) {
    console.log(`Updating block UI: ${isBlocked}`);
    
    // Update the block status display
    if (blockStatusDisplay) {
        blockStatusDisplay.textContent = isBlocked ? 'Blocked' : 'Unblocked';
        blockStatusDisplay.className = isBlocked ? 'status-blocked' : 'status-unblocked';
    }
    
    // Update button visibility
    if (blockButton) {
        blockButton.style.display = isBlocked ? 'none' : 'block';
    }
    
    if (unblockButton) {
        unblockButton.style.display = isBlocked ? 'block' : 'none';
    }
    
    // Update the device in our list
    if (connectedDeviceId) {
        const deviceIndex = connectedDevices.findIndex(device => device.id === connectedDeviceId);
        if (deviceIndex !== -1) {
            connectedDevices[deviceIndex].blocked = isBlocked;
            updateDeviceListUI();
        }
    }
}

function updateBlockStatus(isBlocked) {
    console.log(`Updating block status: ${isBlocked}`);
    
    // Update our local state
    isDeviceBlocked = isBlocked;
    
    // Update the UI
    updateBlockUI(isBlocked);
    
    // If this is called from a place where we don't have the device ID,
    // but we have a connected device, use that
    const deviceId = connectedDeviceId;
    
    if (deviceId) {
        // Update the device in our list
        const deviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
        if (deviceIndex !== -1) {
            connectedDevices[deviceIndex].blocked = isBlocked;
            updateDeviceListUI();
        }
    }
}

function setupDisconnectHandlers(deviceId) {
    console.log(`Setting up disconnect handlers for device ${deviceId}`);
    
    // Set up a listener for the device's connection status
    const connectionRef = database.ref(`registered_devices/${deviceId}/controllerConnected`);
    
    // Listen for changes to the connection status
    connectionRef.on('value', (snapshot) => {
        const isConnected = snapshot.val();
        console.log(`Device ${deviceId} connection status changed to: ${isConnected}`);
        
        if (isConnected === false) {
            // Device is now offline
            deviceStatusMap[deviceId] = 'offline';
            updateDeviceStatusUI(deviceId, 'offline');
            logDisconnectionEvent(deviceId, Date.now());
        } else {
            // Device is now online
            deviceStatusMap[deviceId] = 'online';
            updateDeviceStatusUI(deviceId, 'online');
        }
        
        // Update counts
        updateDeviceCounts();
    });
    
    // Set up a periodic check for this device
    const checkInterval = setInterval(() => {
        // Skip if we're no longer tracking this device
        if (!connectedDevices.some(device => device.id === deviceId)) {
            clearInterval(checkInterval);
            return;
        }
        
        // Check the device's connection status
        connectionRef.once('value')
            .then(snapshot => {
                const isConnected = snapshot.val();
                
                // If the status has changed, the listener above will handle it
                // This is just a backup check
                console.log(`Periodic check for device ${deviceId}: ${isConnected ? 'online' : 'offline'}`);
            })
            .catch(error => {
                console.error(`Error checking device ${deviceId} status:`, error);
            });
    }, 15000); // Check every 15 seconds
    
    // Store the interval ID so we can clear it later
    deviceStatusMap[deviceId + '_interval'] = checkInterval;
}

function disconnectFromDevice() {
    console.log("Disconnecting from all devices");
    
    // Disconnect all devices
    const disconnectPromises = connectedDevices.map(device => {
        return disconnectSingleDevice(device.id);
    });
    
    Promise.all(disconnectPromises)
        .then(() => {
            console.log("All devices disconnected successfully");
            
            // Reset local state
            connectedDevices = [];
            connectedDeviceId = null;
            isDeviceBlocked = false;
            
            // Clear device status map
            for (const key in deviceStatusMap) {
                if (key.endsWith('_interval')) {
                    clearInterval(deviceStatusMap[key]);
                }
                delete deviceStatusMap[key];
            }
            
            // Update UI
            updateConnectionUI(false);
            updateDeviceListUI();
            updateDeviceCounts();
            
            // Restart the scanner
            setTimeout(restartScanner, 500);
        })
        .catch(error => {
            console.error("Error disconnecting devices:", error);
            alert('Error disconnecting devices: ' + error.message);
            
            // Even if there's an error, reset the UI
            connectedDevices = [];
            connectedDeviceId = null;
            isDeviceBlocked = false;
            
            // Clear device status map
            for (const key in deviceStatusMap) {
                if (key.endsWith('_interval')) {
                    clearInterval(deviceStatusMap[key]);
                }
                delete deviceStatusMap[key];
            }
            
            updateConnectionUI(false);
            updateDeviceListUI();
            updateDeviceCounts();
            setTimeout(restartScanner, 500);
        });
}

function disconnectSingleDevice(deviceId) {
    console.log(`Disconnecting device ${deviceId}`);
    
    // Remove device listeners
    database.ref(`registered_devices/${deviceId}/controllerConnected`).off();
    database.ref(`registered_devices/${deviceId}/isBlocked`).off();
    
    // Create updates object for atomic updates
    const updates = {};
    
    // Always set controllerConnected to false
    updates[`registered_devices/${deviceId}/controllerConnected`] = false;
    
    // Also set isBlocked to false to ensure device is unblocked when disconnected
    updates[`registered_devices/${deviceId}/isBlocked`] = false;
    
    // Update Firebase atomically
    return database.ref().update(updates)
        .then(() => {
            console.log(`Device ${deviceId} disconnected and unblocked successfully`);
            
            // Remove from our local array
            const deviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
            if (deviceIndex !== -1) {
                connectedDevices.splice(deviceIndex, 1);
            }
            
            // Clear from our status map
            delete deviceStatusMap[deviceId];
            
            // Clear any intervals for this device
            if (deviceStatusMap[deviceId + '_pingInterval']) {
                clearInterval(deviceStatusMap[deviceId + '_pingInterval']);
                delete deviceStatusMap[deviceId + '_pingInterval'];
            }
            
            if (deviceStatusMap[deviceId + '_interval']) {
                clearInterval(deviceStatusMap[deviceId + '_interval']);
                delete deviceStatusMap[deviceId + '_interval'];
            }
            
            // Log the disconnection
            logDisconnectionEvent(deviceId, Date.now());
            
            // If this was the active device, update UI
            if (connectedDeviceId === deviceId) {
                if (connectedDevices.length > 0) {
                    // Switch to another device
                    switchActiveDevice(connectedDevices[0].id);
                } else {
                    // No more devices, reset UI
                    connectedDeviceId = null;
                    isDeviceBlocked = false;
                    updateConnectionUI(false);
                }
            }
            
            // Update the device list and counts
            updateDeviceListUI();
            updateDeviceCounts();
            
            return Promise.resolve();
        })
        .catch(error => {
            console.error(`Error disconnecting device ${deviceId}:`, error);
            
            // Even if there's an error, remove from our local tracking
            const deviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
            if (deviceIndex !== -1) {
                connectedDevices.splice(deviceIndex, 1);
            }
            
            // Clear from our status map
            delete deviceStatusMap[deviceId];
            
            // Update UI
            updateDeviceListUI();
            updateDeviceCounts();
            
            return Promise.reject(error);
        });
}

function startHeartbeat() {
    // Clear any existing heartbeat
    if (window.heartbeatInterval) {
        clearInterval(window.heartbeatInterval);
    }
    
    // Set up a new heartbeat that runs every 30 seconds
    window.heartbeatInterval = setInterval(() => {
        // Skip if no devices are connected
        if (connectedDevices.length === 0) return;
        
        console.log("Running heartbeat check for all connected devices");
        
        // Update our own timestamp to show we're still online
        database.ref('.info/connected').once('value', (snapshot) => {
            if (snapshot.val() === true) {
                // We're connected, update all device statuses
                connectedDevices.forEach(device => {
                    database.ref(`registered_devices/${device.id}/controllerConnected`).once('value')
                        .then(snapshot => {
                            const isConnected = snapshot.val();
                            
                            // If Firebase says it's not connected but we think it is
                            if (isConnected === false && deviceStatusMap[device.id] === 'online') {
                                console.log(`Heartbeat detected device ${device.id} is offline`);
                                deviceStatusMap[device.id] = 'offline';
                                updateDeviceStatusUI(device.id, 'offline');
                                logDisconnectionEvent(device.id, Date.now());
                                updateDeviceCounts();
                            }
                            // If Firebase says it's connected but we think it isn't
                            else if (isConnected === true && deviceStatusMap[device.id] === 'offline') {
                                console.log(`Heartbeat detected device ${device.id} is back online`);
                                deviceStatusMap[device.id] = 'online';
                                updateDeviceStatusUI(device.id, 'online');
                                updateDeviceCounts();
                            }
                        })
                        .catch(error => {
                            console.error(`Heartbeat error for device ${device.id}:`, error);
                        });
                });
            }
        });
    }, 30000); // Check every 30 seconds
}

function shouldPlayNotificationSound(deviceId, reason) {
    // Only play sound for genuine disconnections
    if (reason !== 'heartbeat-timeout' && reason !== 'connection-lost') {
        return false;
    }
    
    // Don't play sound if we've already notified about this device recently
    const lastNotificationTime = deviceStatusMap[deviceId + '_lastNotification'] || 0;
    const now = Date.now();
    
    // Only notify once every 5 minutes for the same device
    if (now - lastNotificationTime < 300000) {
        return false;
    }
    
    // Store the notification time
    deviceStatusMap[deviceId + '_lastNotification'] = now;
    return true;
}

function updateDeviceListUI() {
    // Clear the device list
    deviceListContainer.innerHTML = '';
    
    // Add a header with device count
    const header = document.createElement('h3');
    header.textContent = `Connected Devices (${connectedDevices.length})`;
    header.style.color = '#ffffff';
    header.style.fontWeight = 'bold';
    deviceListContainer.appendChild(header);
    
    // Add each device to the list
    connectedDevices.forEach(device => {
        const deviceItem = document.createElement('div');
        deviceItem.className = 'device-item';
        deviceItem.setAttribute('data-device-id', device.id);
        
        // Add active class if this is the active device
        if (device.id === connectedDeviceId) {
            deviceItem.classList.add('active-device');
        }
        
        // Add online/offline class
        if (deviceStatusMap[device.id] === 'online') {
            deviceItem.classList.add('device-online');
        } else {
            deviceItem.classList.add('device-offline');
        }
        
        const deviceInfo = document.createElement('div');
        deviceInfo.className = 'device-info';
        deviceInfo.addEventListener('click', () => switchActiveDevice(device.id));
        
        const deviceName = document.createElement('div');
        deviceName.className = 'device-name';
        
        // Log the device name being used
        console.log(`Device ${device.id} display name:`, device.displayName);
        
        // Use the displayName if available, otherwise use a shortened device ID
        deviceName.textContent = device.displayName || `Device ${device.id.substring(0, 8)}...`;
        
        const deviceIdElement = document.createElement('div');
        deviceIdElement.className = 'device-id';
        deviceIdElement.textContent = `ID: ${device.id.substring(0, 8)}...`;
        
        deviceInfo.appendChild(deviceName);
        deviceInfo.appendChild(deviceIdElement);
        
        const deviceStatus = document.createElement('div');
        deviceStatus.className = 'device-status';
        
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'status-indicator';
        if (deviceStatusMap[device.id] === 'online') {
            statusIndicator.classList.add('status-connected');
            statusIndicator.title = 'Online';
        } else {
            statusIndicator.classList.add('status-disconnected');
            statusIndicator.title = 'Offline';
            
            // Add offline alert
            const offlineAlert = document.createElement('div');
            offlineAlert.className = 'offline-alert';
            offlineAlert.textContent = 'Device Offline';
            deviceStatus.appendChild(offlineAlert);
        }
        
        deviceStatus.appendChild(statusIndicator);
        
        const deviceControls = document.createElement('div');
        deviceControls.className = 'device-controls';
        
        const blockButton = document.createElement('button');
        blockButton.className = 'btn-block';
        blockButton.textContent = 'Block';
        blockButton.disabled = device.isBlocked;
        blockButton.addEventListener('click', () => toggleDeviceBlock(device.id, true));
        
        const unblockButton = document.createElement('button');
        unblockButton.className = 'btn-unblock';
        unblockButton.textContent = 'Unblock';
        unblockButton.disabled = !device.isBlocked;
        unblockButton.addEventListener('click', () => toggleDeviceBlock(device.id, false));
        
        const disconnectButton = document.createElement('button');
        disconnectButton.className = 'btn-disconnect';
        disconnectButton.textContent = 'Disconnect';
        disconnectButton.addEventListener('click', () => disconnectSingleDevice(device.id));
        
        deviceControls.appendChild(blockButton);
        deviceControls.appendChild(unblockButton);
        deviceControls.appendChild(disconnectButton);
        
        deviceItem.appendChild(deviceInfo);
        deviceItem.appendChild(deviceStatus);
        deviceItem.appendChild(deviceControls);
        
        deviceListContainer.appendChild(deviceItem);
    });
    
    // Show/hide the device list based on whether we have devices
    if (connectedDevices.length > 0) {
        deviceListContainer.style.display = 'block';
        
        // Show the Add Device button
        const existingAddDeviceButton = document.getElementById('addDeviceButton');
        if (existingAddDeviceButton) {
            existingAddDeviceButton.style.display = 'block';
        } else if (addDeviceButton) {
            addDeviceButton.style.display = 'block';
        }
    } else {
        deviceListContainer.style.display = 'none';
        
        // Hide the Add Device button
        const existingAddDeviceButton = document.getElementById('addDeviceButton');
        if (existingAddDeviceButton) {
            existingAddDeviceButton.style.display = 'none';
        } else if (addDeviceButton) {
            addDeviceButton.style.display = 'none';
        }
    }
}

function loadConnectedDevices() {
    // Get teacher ID from a hidden input field
    const teacherId = document.getElementById('teacherId').value;
    console.log("Loading user data for all connected devices");
    
    database.ref('registered_devices').orderByChild('teacherId').equalTo(teacherId).on('value', (snapshot) => {
        // Create a temporary array to hold devices
        const tempDevices = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const device = childSnapshot.val();
                device.id = childSnapshot.key;
                
                // Add to temporary array
                tempDevices.push(device);
                
                // If the device has a userId, fetch the user info from Firestore
                if (device.userId) {
                    console.log("Found device with userId:", device.userId);
                    
                    // Fetch user data from Firestore
                    db.collection('users').doc(device.userId).get()
                        .then((doc) => {
                            if (doc.exists) {
                                const userData = doc.data();
                                console.log(`Found user data for device ${device.id}:`, userData);
                                
                                // Create display name from firstName and lastName or use email
                                let displayName = '';
                                if (userData.firstName && userData.lastName) {
                                    displayName = `${userData.firstName} ${userData.lastName}`;
                                } else if (userData.name) {
                                    displayName = userData.name;
                                } else if (userData.email) {
                                    displayName = userData.email.split('@')[0]; // Use part before @ in email
                                } else if (userData.username) {
                                    displayName = userData.username;
                                }
                                
                                if (displayName) {
                                    console.log(`Setting display name for device ${device.id}: ${displayName}`);
                                    
                                    // Update the device record with the display name
                                    database.ref(`registered_devices/${device.id}`).update({
                                        displayName: displayName
                                    });
                                    
                                    // Find the device in our array and update it
                                    const deviceIndex = connectedDevices.findIndex(d => d.id === device.id);
                                    if (deviceIndex !== -1) {
                                        connectedDevices[deviceIndex].displayName = displayName;
                                        
                                        // Update UI to reflect the change immediately
                                        updateDeviceListUI();
                                    }
                                }
                            } else {
                                console.log(`No user data found for userId: ${device.userId}`);
                            }
                        })
                        .catch((error) => {
                            console.error(`Error getting user data:`, error);
                        });
                }
            });
        }
        
        // Update our main array
        connectedDevices = tempDevices;
        
        // Update UI with the devices
        updateDeviceListUI();
        updateDeviceCounts();
    });
}


function toggleDeviceBlock(deviceId, blockState) {
    database.ref(`registered_devices/${deviceId}/isBlocked`).set(blockState)
        .then(() => {
            // Update local state
            const deviceIndex = connectedDevices.findIndex(device => device.id === deviceId);
            if (deviceIndex !== -1) {
                connectedDevices[deviceIndex].isBlocked = blockState;
                updateDeviceListUI();
                
                // If this is the active device, update the main UI
                if (connectedDeviceId === deviceId) {
                    isDeviceBlocked = blockState;
                    updateBlockStatusUI();
                }
            }
        })
        .catch(error => {
            console.error("Error toggling device block:", error);
            alert('Error toggling device block: ' + error.message);
        });
}

// Update UI based on connection status
function updateConnectionUI(isConnected) {
    console.log(`Updating connection UI: ${isConnected}`);
    
    // Update status indicator
    updateConnectionStatus(isConnected);
    
    // Show/hide appropriate sections
    if (isConnected) {
        deviceInfo.classList.remove('hidden');
        controlPanel.classList.remove('hidden');
        setupSection.classList.add('hidden');
    } else {
        deviceInfo.classList.add('hidden');
        controlPanel.classList.add('hidden');
        setupSection.classList.remove('hidden');
    }
}

function switchActiveDevice(deviceId) {
    // Find the device in our array
    const device = connectedDevices.find(d => d.id === deviceId);
    if (!device) return;
    
    // Update active device
    connectedDeviceId = deviceId;
    // Use displayName if available, otherwise use device ID
    deviceIdDisplay.textContent = device.displayName || device.id;
    isDeviceBlocked = device.isBlocked;
    
    // Update UI
    updateBlockStatusUI();
    
    // Highlight the active device in the list
    updateDeviceListUI();
}


// Update UI based on block status
function updateBlockStatusUI() {
    blockStatusDisplay.textContent = isDeviceBlocked ? 'Blocked' : 'Unblocked';
    blockButton.disabled = isDeviceBlocked;
    unblockButton.disabled = !isDeviceBlocked;
}

// Add a disconnect button event listener if not already present
disconnectButton.addEventListener('click', function() {
    disconnectFromDevice();
});

// Set up button event listeners
blockButton.addEventListener('click', function() {
    // Block all connected devices
    if (connectedDevices.length > 0) {
        const blockPromises = connectedDevices.map(device => {
            return database.ref('registered_devices/' + device.id + '/isBlocked').set(true)
                .then(() => {
                    console.log(`Device ${device.id} blocked successfully`);
                })
                .catch(error => {
                    console.error(`Error blocking device ${device.id}:`, error);
                    throw error; // Propagate the error
                });
        });
        
        Promise.all(blockPromises)
            .then(() => {
                console.log("All devices blocked successfully");
                // Update local state for all devices
                connectedDevices.forEach(device => {
                    device.isBlocked = true;
                });
                
                // Update UI
                isDeviceBlocked = true;
                updateBlockStatusUI();
                updateDeviceListUI();
            })
            .catch(error => {
                console.error("Error blocking all devices:", error);
                alert('Error blocking all devices: ' + error.message);
            });
    }
});

unblockButton.addEventListener('click', function() {
    // Unblock all connected devices
    if (connectedDevices.length > 0) {
        const unblockPromises = connectedDevices.map(device => {
            return database.ref('registered_devices/' + device.id + '/isBlocked').set(false)
                .then(() => {
                    console.log(`Device ${device.id} unblocked successfully`);
                })
                .catch(error => {
                    console.error(`Error unblocking device ${device.id}:`, error);
                    throw error; // Propagate the error
                });
        });
        
        Promise.all(unblockPromises)
            .then(() => {
                console.log("All devices unblocked successfully");
                // Update local state for all devices
                connectedDevices.forEach(device => {
                    device.isBlocked = false;
                });
                
                // Update UI
                isDeviceBlocked = false;
                updateBlockStatusUI();
                updateDeviceListUI();
            })
            .catch(error => {
                console.error("Error unblocking all devices:", error);
                alert('Error unblocking all devices: ' + error.message);
            });
    }
});