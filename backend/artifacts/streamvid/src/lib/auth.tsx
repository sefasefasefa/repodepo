import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useGetMe, useLogin, useLogout, useRegister } from "@workspace/api-client-react";
import type { LoginBody, RegisterBody, User } from "@workspace/api-client-react/src/generated/api.schemas";
import { useLocation } from "wouter";
import { getMeFromInit, invalidateInitCache } from "@/lib/init-prefetch";

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

  // init-prefetch'ten gelen me verisi — sayfa yüklenirken /api/me round-trip'i önler
  const [initUser, setInitUser] = useState<User | null>(null);
  const [initUserLoaded, setInitUserLoaded] = useState(false);

  useEffect(() => {
    if (!token) {
      setInitUserLoaded(true);
      return;
    }
    getMeFromInit().then((me) => {
      if (me) setInitUser(me as unknown as User);
      setInitUserLoaded(true);
    }).catch(() => {
      setInitUserLoaded(true);
    });
  }, []); // sadece mount'ta bir kez çalışır

  const {
    data: fetchedUser,
    isLoading: isUserLoading,
    refetch,
    error: userError,
  } = useGetMe({
    query: {
      enabled: !!token && initUserLoaded && !initUser,
      retry: 1,
      retryDelay: 2000,
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
    if (status === 401 || status === 403) {
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
    setInitUser(null);
    const res = await loginMutation.mutateAsync({ data });
    const newToken = (res as any).access ?? res.token;
    localStorage.setItem("token", newToken);
    invalidateInitCache();
    setToken(newToken);
    // Don't await refetch() — in TanStack Query v5 calling refetch() while
    // the query is still in disabled state (enabled:false, before the
    // setToken re-render) returns a promise that never resolves, keeping
    // the login button in "submitting" state forever. The query fires
    // automatically once setToken(newToken) triggers a re-render.
  };

  const handleRegister = async (data: RegisterBody) => {
    localStorage.removeItem("token");
    setToken(null);
    setInitUser(null);
    const res = await registerMutation.mutateAsync({ data });
    const newToken = (res as any).access ?? res.token;
    localStorage.setItem("token", newToken);
    invalidateInitCache();
    setToken(newToken);
    // Same as handleLogin — don't await refetch() to avoid a TanStack Query v5
    // stall when the query is still disabled at call time.
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setInitUser(null);
      setToken(null);
      setLocation("/");
    }
  };

  // initUser varsa onu kullan (hızlı), yoksa useGetMe'den gelen veriyi kullan
  const user = initUser ?? fetchedUser ?? null;
  const isAuthenticated = !!token;
  const isLoading = !!token && !initUserLoaded && isUserLoading;

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        token,
        isLoading,
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
