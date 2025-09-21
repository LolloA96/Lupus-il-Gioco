// firebase-config.js

// Configurazione del tuo progetto
const firebaseConfig = {
  apiKey: "AIzaSyDutZ8hspHoLsZ75tW7JJV9sR6MELQA10Nw",
  authDomain: "lupus-in-fabula-52ccb.firebaseapp.com",
  databaseURL: "https://lupus-in-fabula-52ccb-default-rtdb.firebaseio.com",
  projectId: "lupus-in-fabula-52ccb",
  storageBucket: "lupus-in-fabula-52ccb.appspot.com",
  messagingSenderId: "562350608842",
  appId: "1:562350608842:web:d91c0e0452e4666935bf33",
  measurementId: "G-SW68SPWZ9G"
};

// Inizializza Firebase (usa la variabile globale `firebase` creata dalla CDN)
firebase.initializeApp(firebaseConfig);

// Ottieni Firestore
const db = firebase.firestore();