"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest, User } from "../utils/api";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      const storedToken = localStorage.getItem("auth_token");
      if (storedToken) {
        setToken(storedToken);
        try {
          const response = await apiRequest<{ user: User }>("auth/me", {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          setUser(response.user);

        } catch (error) {
          console.error("Token verification failed:", error);
          localStorage.removeItem("auth_token");
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest<{ token: string; user: User }>("auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      localStorage.setItem("auth_token", response.token);
      setToken(response.token);
      setUser(response.user);
      router.push("/");
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest<{ token: string; user: User }>("auth/register", {
        method: "POST",
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      
      localStorage.setItem("auth_token", response.token);
      setToken(response.token);
      setUser(response.user);
      router.push("/");
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
