import { useState, useEffect, useCallback } from "react";
import { get, setToken, clearToken } from "../api/client";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface User {
  id: string;
  name: string;
  preferredChannel: string;
  workspaces: Workspace[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await get<User>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("guac_token");
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = useCallback((token: string) => {
    setToken(token);
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return { user, loading, login, logout, refetch: fetchUser };
}
