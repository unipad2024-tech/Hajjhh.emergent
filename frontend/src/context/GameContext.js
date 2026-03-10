import React, { createContext, useContext, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GameContext = createContext(null);

export const GameProvider = ({ children }) => {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hujjah_session") || "null"); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hujjah_user") || "null"); }
    catch { return null; }
  });
  const [userToken, setUserToken] = useState(() => localStorage.getItem("hujjah_user_token") || null);

  const saveSession = (s) => {
    setSession(s);
    if (s) localStorage.setItem("hujjah_session", JSON.stringify(s));
    else localStorage.removeItem("hujjah_session");
  };

  const loginUser = async (email, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password });
    setCurrentUser(data.user);
    setUserToken(data.token);
    localStorage.setItem("hujjah_user", JSON.stringify(data.user));
    localStorage.setItem("hujjah_user_token", data.token);
    return data;
  };

  const registerUser = async (email, username, password) => {
    const { data } = await axios.post(`${API}/auth/register`, { email, username, password });
    setCurrentUser(data.user);
    setUserToken(data.token);
    localStorage.setItem("hujjah_user", JSON.stringify(data.user));
    localStorage.setItem("hujjah_user_token", data.token);
    return data;
  };

  const logoutUser = () => {
    setCurrentUser(null);
    setUserToken(null);
    localStorage.removeItem("hujjah_user");
    localStorage.removeItem("hujjah_user_token");
  };

  const refreshUser = async () => {
    if (!userToken) return;
    try {
      const { data } = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${userToken}` } });
      setCurrentUser(data);
      localStorage.setItem("hujjah_user", JSON.stringify(data));
    } catch { logoutUser(); }
  };

  const createSession = async (team1_name, team2_name) => {
    setLoading(true);
    try {
      const payload = { team1_name, team2_name };
      if (currentUser?.id) payload.user_id = currentUser.id;
      const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
      const { data } = await axios.post(`${API}/game/session`, payload, { headers });
      saveSession(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const updateSession = async (updates) => {
    if (!session?.id) return;
    try {
      const { data } = await axios.put(`${API}/game/session/${session.id}`, updates);
      saveSession(data);
      return data;
    } catch (e) {
      console.error("Session update error", e);
    }
  };

  const getNextQuestion = async (category_id, difficulty) => {
    if (!session?.id) return null;
    const headers = userToken ? { Authorization: `Bearer ${userToken}` } : {};
    try {
      const { data } = await axios.post(
        `${API}/game/session/${session.id}/question?category_id=${category_id}&difficulty=${difficulty}`,
        {},
        { headers }
      );
      return data;
    } catch (e) {
      console.error("Get question error", e);
      return null;
    }
  };

  const updateScore = async (team, points) => {
    if (!session?.id) return;
    try {
      const { data } = await axios.post(`${API}/game/session/${session.id}/score`, { team, points });
      saveSession({ ...session, team1_score: data.team1_score, team2_score: data.team2_score });
      return data;
    } catch (e) {
      console.error("Score update error", e);
    }
  };

  const resetGame = () => saveSession(null);

  return (
    <GameContext.Provider value={{
      session, loading, currentUser, userToken,
      createSession, updateSession, getNextQuestion, updateScore,
      resetGame, saveSession, loginUser, registerUser, logoutUser, refreshUser
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
};

export default GameContext;
