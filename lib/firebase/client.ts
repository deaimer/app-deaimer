import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  setPersistence,
  type AuthError,
  type UserCredential,
} from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";

const firebaseEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
} as const;

const firebaseConfig = {
  apiKey: firebaseEnv.apiKey,
  authDomain: firebaseEnv.authDomain,
  projectId: firebaseEnv.projectId,
  storageBucket: firebaseEnv.storageBucket,
  messagingSenderId: firebaseEnv.messagingSenderId,
  appId: firebaseEnv.appId,
  measurementId: firebaseEnv.measurementId,
};

const requiredFirebaseEnv = [
  {
    key: "NEXT_PUBLIC_FIREBASE_API_KEY",
    value: firebaseEnv.apiKey,
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    value: firebaseEnv.authDomain,
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    value: firebaseEnv.projectId,
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    value: firebaseEnv.storageBucket,
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    value: firebaseEnv.messagingSenderId,
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_APP_ID",
    value: firebaseEnv.appId,
  },
] as const;

let cachedProvider: GoogleAuthProvider | null = null;
let cachedAuth: Auth | null = null;
let cachedStorage: FirebaseStorage | null = null;
let cachedPersistencePromise: Promise<void> | null = null;
let cachedRedirectResultPromise: Promise<UserCredential | null> | null = null;

function shouldFallbackToRedirect(error: unknown) {
  const code = (error as AuthError | undefined)?.code;

  return (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/popup-closed-by-user"
  );
}

export function isFirebaseConfigured() {
  return requiredFirebaseEnv.every((entry) => Boolean(entry.value));
}

export function getFirebaseConfigError() {
  if (isFirebaseConfigured()) {
    return null;
  }

  const missing = requiredFirebaseEnv
    .filter((entry) => !entry.value)
    .map((entry) => entry.key);

  return `Firebase is not configured yet. Add these environment variables: ${missing.join(", ")}`;
}

function getFirebaseApp(): FirebaseApp {
  const configError = getFirebaseConfigError();

  if (configError) {
    throw new Error(configError);
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}

function getFirebaseAuth(app: FirebaseApp): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(app);
  }

  if (!cachedPersistencePromise) {
    cachedPersistencePromise = setPersistence(
      cachedAuth,
      browserLocalPersistence,
    ).catch(() => undefined);
  }

  return cachedAuth;
}

export async function ensureFirebaseAuthPersistence() {
  const app = getFirebaseApp();
  getFirebaseAuth(app);
  await cachedPersistencePromise;
}

export async function resolveFirebaseRedirectSignIn() {
  const app = getFirebaseApp();
  const auth = getFirebaseAuth(app);
  await ensureFirebaseAuthPersistence();

  if (!cachedRedirectResultPromise) {
    cachedRedirectResultPromise = getRedirectResult(auth)
      .then((result) => {
        cachedRedirectResultPromise = null;
        return result;
      })
      .catch((error) => {
        cachedRedirectResultPromise = null;
        throw error;
      });
  }

  return cachedRedirectResultPromise;
}

export async function signInWithGoogle(auth: Auth, googleProvider: GoogleAuthProvider) {
  await ensureFirebaseAuthPersistence();

  try {
    await signInWithPopup(auth, googleProvider);
    return "popup" as const;
  } catch (error) {
    if (!shouldFallbackToRedirect(error)) {
      throw error;
    }

    await signInWithRedirect(auth, googleProvider);
    return "redirect" as const;
  }
}

export function getFirebaseClientServices(): {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
  googleProvider: GoogleAuthProvider;
} {
  const app = getFirebaseApp();

  if (!cachedProvider) {
    cachedProvider = new GoogleAuthProvider();
    cachedProvider.setCustomParameters({
      prompt: "select_account",
    });
  }

  return {
    app,
    auth: getFirebaseAuth(app),
    firestore: getFirestore(app),
    storage: cachedStorage ?? (cachedStorage = getStorage(app)),
    googleProvider: cachedProvider,
  };
}
