// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDnLtFPpsfSEltAwBlgAVP-3UtqboRfdMs",
  authDomain: "face-detection-app-8a2d8.firebaseapp.com",
  projectId: "face-detection-app-8a2d8",
  storageBucket: "face-detection-app-8a2d8.firebasestorage.app",
  messagingSenderId: "171413724831",
  appId: "1:171413724831:web:5430a6d43a158f12778caa",
  measurementId: "G-MPY4RNG49P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

