const firebaseConfig = {
    apiKey: "AIzaSyBPyX-vMxXf-Wn4Rx9jKlHUWYWYWcxqpuM",
    authDomain: "edulock-register-firebase.firebaseapp.com",
    databaseURL: "https://edulock-register-firebase-default-rtdb.firebaseio.com",
    projectId: "edulock-register-firebase",
    storageBucket: "edulock-register-firebase.appspot.com",
    messagingSenderId: "1039430447528",
    appId: "1:1039430447528:web:c4f4514659a2a2c24d5e0c"
};

let database;
let firestore;

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    database  = firebase.database();
    firestore = firebase.firestore();
    firestore.settings({ merge: true });
} catch (e) {
    console.error('Firebase init error:', e);
}
