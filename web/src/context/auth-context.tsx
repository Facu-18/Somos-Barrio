"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiClient, setAccessToken } from "@/lib/api-client";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  barrio?: { id: string; name: string; slug: string } | null;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // We first try to call /auth/refresh directly to get the access token from the cookie
        const refreshRes = await apiClient.post("/auth/refresh");
        if (refreshRes.data.success && refreshRes.data.data.accessToken) {
          setAccessToken(refreshRes.data.data.accessToken);
          
          // Now get the user info
          const meRes = await apiClient.get("/auth/me");
          if (meRes.data.success) {
            const fetchedUser = meRes.data.data;
            if (fetchedUser.role === "ADMIN" || fetchedUser.role === "EDITOR") {
              setUser(fetchedUser);
            } else {
              // Valid user, but not admin/editor
              await apiClient.post("/auth/logout");
              setAccessToken(null);
              setUser(null);
            }
          }
        }
      } catch {
        // Not authenticated
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => setUser(null);
    window.addEventListener("auth:expired", handleExpiredSession);
    return () => window.removeEventListener("auth:expired", handleExpiredSession);
  }, []);

  useEffect(() => {
    // Redirect logic
    if (!isLoading) {
      if (!user && pathname !== "/login") {
        router.push("/login");
      } else if (user && pathname === "/login") {
        router.push("/dashboard");
      }
    }
  }, [isLoading, user, pathname, router]);

  const login = (accessToken: string, loggedUser: User) => {
    if (loggedUser.role === "ADMIN" || loggedUser.role === "EDITOR") {
      setAccessToken(accessToken);
      setUser(loggedUser);
      router.push("/dashboard");
    } else {
      throw new Error("No tienes permisos de administrador.");
    }
  };

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (error) {
      console.error("Error during logout", error);
    } finally {
      setAccessToken(null);
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
