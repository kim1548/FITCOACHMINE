import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api/config";

const AuthContext = createContext();

const loadStored = () => ({
  username: localStorage.getItem("username"),
  nickname: localStorage.getItem("nickname") || null,
  avatar: localStorage.getItem("avatar") || null,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  // 앱이 켜질 때 토큰이 있으면 로컬 정보로 즉시 복원 후, 서버 /me 로 최신 프로필 동기화.
  useEffect(() => {
    if (!token) return;
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(loadStored());
    axios
      .get(`${API_BASE_URL}/user/me`)
      .then((res) => {
        const { nickname = null, avatar = null } = res.data || {};
        if (nickname) localStorage.setItem("nickname", nickname);
        else localStorage.removeItem("nickname");
        if (avatar) localStorage.setItem("avatar", avatar);
        else localStorage.removeItem("avatar");
        setUser((u) => ({ ...(u || {}), nickname, avatar }));
      })
      .catch(() => {});
  }, [token]);

  const login = (newToken, username) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", username);
    setToken(newToken);
    setUser({ username, nickname: null, avatar: null });
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
  };

  // 프로필(닉네임·아바타) 변경 후 컨텍스트·로컬스토리지 갱신.
  const updateProfile = ({ nickname, avatar } = {}) => {
    if (nickname !== undefined) {
      if (nickname) localStorage.setItem("nickname", nickname);
      else localStorage.removeItem("nickname");
    }
    if (avatar !== undefined) {
      if (avatar) localStorage.setItem("avatar", avatar);
      else localStorage.removeItem("avatar");
    }
    setUser((u) => ({
      ...(u || {}),
      ...(nickname !== undefined ? { nickname: nickname || null } : {}),
      ...(avatar !== undefined ? { avatar: avatar || null } : {}),
    }));
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
