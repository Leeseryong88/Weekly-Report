"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUser, subscribeToUser } from "@/lib/firestore/services";
import type { User } from "@/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      setFirebaseUser(fbUser);
      setUser(null);

      if (!fbUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeProfile = subscribeToUser(
        fbUser.uid,
        (profile) => {
          setUser(profile);
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeProfile?.();
      unsub();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!firebaseUser) return;
    try {
      setUser(await getUser(firebaseUser.uid));
    } catch {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
