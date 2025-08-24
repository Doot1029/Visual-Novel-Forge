import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

// This is your web app's Firebase configuration, connected to your project.
const firebaseConfig = {
  apiKey: "AIzaSyAQCA6Y1uMMkmDdVtmFsVNEBS9TlZXtiSc",
  authDomain: "visual-novel-forge.firebaseapp.com",
  databaseURL: "https://visual-novel-forge-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "visual-novel-forge",
  storageBucket: "visual-novel-forge.firebasestorage.app",
  messagingSenderId: "370403552922",
  appId: "1:370403552922:web:b2521765842590623b3923",
  measurementId: "G-WB2RX95PM1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);

let authPromise: Promise<void> | null = null;

export const signInAnonymouslyIfNeeded = (): Promise<void> => {
    if (auth.currentUser) {
        return Promise.resolve();
    }
    if (authPromise) {
        return authPromise;
    }

    authPromise = new Promise<void>((resolve, reject) => {
        // onAuthStateChanged returns a function to unsubscribe.
        // It is called immediately with the current state, and then again on any change.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // We have a user, so authentication is successful.
                unsubscribe();
                resolve();
            } else {
                // No user is signed in; attempt to sign in anonymously.
                // The listener will be called again once sign-in completes.
                signInAnonymously(auth).catch((error) => {
                    unsubscribe(); // Clean up on failure.
                    console.error("Error signing in anonymously:", error);
                    alert("Could not connect to game services. Please check your internet connection and refresh the page to try again.");
                    reject(error);
                });
            }
        }, (error) => {
            // This handles errors within the auth state observer itself.
            unsubscribe();
            console.error("Auth state observer error:", error);
            reject(error);
        });
    }).finally(() => {
        // Once the promise is settled (resolved or rejected), clear the
        // singleton promise so that subsequent calls can re-authenticate if needed.
        authPromise = null;
    });

    return authPromise;
};