import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tl_token");
    if (token) {
      getMe()
        .then((data) => setUser(data.user))
        .catch(() => localStorage.removeItem("tl_token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const saveAuth = (token, userData) => {
    localStorage.setItem("tl_token", token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("tl_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, saveAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
