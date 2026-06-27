import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useGetMe, useLogin, useLogout, useRegister } from "@workspace/api-client-react";
import type { LoginBody, RegisterBody, User } from "@workspace/api-client-react/src/generated/api.schemas";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (data: LoginBody) => Promise<void>;
  register: (data: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [, setLocation] = useLocation();
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const {
    data: user,
    isLoading: isUserLoading,
    refetch,
    error: userError,
  } = useGetMe({
    query: {
      enabled: !!token,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 3 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  });

  useEffect(() => {
    if (!userError) return;
    const anyError = userError as any;
    const status =
      anyError?.response?.status ??
      anyError?.status ??
      anyError?.statusCode;
    if (status === 401) {
      setToken(null);
    }
  }, [userError]);

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const logoutMutation = useLogout();

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  const handleLogin = async (data: LoginBody) => {
    localStorage.removeItem("token");
    setToken(null);
    const res = await loginMutation.mutateAsync({ data });
    const newToken = (res as any).access ?? res.token;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    await refetch();
  };

  const handleRegister = async (data: RegisterBody) => {
    localStorage.removeItem("token");
    setToken(null);
    const res = await registerMutation.mutateAsync({ data });
    const newToken = (res as any).access ?? res.token;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    await refetch();
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setToken(null);
      setLocation("/");
    }
  };

  const isAuthenticated = !!token && (isUserLoading || !!user);

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        token,
        isLoading: isUserLoading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
