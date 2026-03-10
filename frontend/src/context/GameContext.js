import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GameContext = createContext(null);

export const GameProvider = ({ children }) => {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hujjah_session") || "null"); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const saveSession = (s) => {
    setSession(s);
    if (s) localStorage.setItem("hujjah_session", JSON.stringify(s));
    else localStorage.removeItem("hujjah_session");
  };

  const createSession = async (team1_name, team2_name) => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/game/session`, { team1_name, team2_name });
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
    try {
      const { data } = await axios.post(
        `${API}/game/session/${session.id}/question?category_id=${category_id}&difficulty=${difficulty}`
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
      session, loading, createSession, updateSession,
      getNextQuestion, updateScore, resetGame, saveSession
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
