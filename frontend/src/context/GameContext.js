import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("hujjah_dark") === "true");
  const [gameSettings, setGameSettings] = useState({ default_timer: 65, word_timers: { "300": 80, "600": 60, "900": 45 } });
  const [currentTurn, setCurrentTurn] = useState(() => parseInt(localStorage.getItem("hujjah_turn") || "1"));

  // Central game state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState(() => {
    // Load selected tiles from localStorage if session exists
    try {
      const s = JSON.parse(localStorage.getItem("hujjah_session") || "null");
      if (s?.id) {
        const raw = localStorage.getItem(`used_${s.id}`);
        return raw ? new Set(JSON.parse(raw)) : new Set();
      }
    } catch {}
    return new Set();
  });
  const [teamScores, setTeamScores] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("hujjah_session") || "null");
      return { team1: s?.team1_score ?? 0, team2: s?.team2_score ?? 0 };
    } catch { return { team1: 0, team2: 0 }; }
  });

  // ─── Game Mode & Tournament ───────────────────────────────────────────────
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem("hujjah_guest") === "true");
  const [gameMode, setGameModeState] = useState(() => localStorage.getItem("hujjah_mode") || "standard");
  const [tournamentState, setTournamentState] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hujjah_tournament") || "null"); } catch { return null; }
  });

  // Load settings on mount
  useEffect(() => {
    axios.get(`${API}/settings`).then(({ data }) => setGameSettings(data)).catch(() => {});
  }, []);

  // Sync teamScores when session changes
  useEffect(() => {
    if (session) {
      setTeamScores({ team1: session.team1_score ?? 0, team2: session.team2_score ?? 0 });
    }
  }, [session]);

  const markTileUsed = useCallback((tileKey) => {
    setSelectedQuestions(prev => {
      const next = new Set(prev);
      next.add(tileKey);
      if (session?.id) {
        localStorage.setItem(`used_${session.id}`, JSON.stringify([...next]));
      }
      return next;
    });
  }, [session]);

  const isTileUsed = useCallback((tileKey) => {
    return selectedQuestions.has(tileKey);
  }, [selectedQuestions]);

  // Restore (undo) a tile — removes it from used set so it reappears on board
  const restoreTile = useCallback((tileKey) => {
    setSelectedQuestions(prev => {
      const next = new Set(prev);
      next.delete(tileKey);
      if (session?.id) {
        localStorage.setItem(`used_${session.id}`, JSON.stringify([...next]));
      }
      return next;
    });
  }, [session]);

  const setGameMode = (mode) => {
    setGameModeState(mode);
    localStorage.setItem("hujjah_mode", mode);
  };

  const setTournament = (state) => {
    setTournamentState(state);
    if (state) localStorage.setItem("hujjah_tournament", JSON.stringify(state));
    else localStorage.removeItem("hujjah_tournament");
  };

  const updateTournament = (updater) => {
    setTournamentState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      localStorage.setItem("hujjah_tournament", JSON.stringify(next));
      return next;
    });
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("hujjah_dark", String(next));
  };

  const switchTurn = () => {
    const next = currentTurn === 1 ? 2 : 1;
    setCurrentTurn(next);
    localStorage.setItem("hujjah_turn", String(next));
  };

  // Manual turn override — set to specific team
  const setTurn = (team) => {
    setCurrentTurn(team);
    localStorage.setItem("hujjah_turn", String(team));
  };

  const resetTurn = () => {
    setCurrentTurn(1);
    localStorage.setItem("hujjah_turn", "1");
  };

  const saveSession = (s) => {
    setSession(s);
    if (s) {
      localStorage.setItem("hujjah_session", JSON.stringify(s));
      setTeamScores({ team1: s.team1_score ?? 0, team2: s.team2_score ?? 0 });
    } else {
      localStorage.removeItem("hujjah_session");
    }
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
    setIsGuest(false);
    localStorage.removeItem("hujjah_user");
    localStorage.removeItem("hujjah_user_token");
    localStorage.removeItem("hujjah_guest");
  };

  const playAsGuest = () => {
    setIsGuest(true);
    localStorage.setItem("hujjah_guest", "true");
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
      setSelectedQuestions(new Set());
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
      setCurrentQuestion(data);
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
      const updated = { ...session, team1_score: data.team1_score, team2_score: data.team2_score };
      saveSession(updated);
      setTeamScores({ team1: data.team1_score, team2: data.team2_score });
      return data;
    } catch (e) {
      console.error("Score update error", e);
    }
  };

  // Set a team's score to an exact value (Game Master live edit)
  const setExactScore = async (team, value) => {
    const current = team === 1 ? teamScores.team1 : teamScores.team2;
    const delta = value - current;
    if (delta === 0) return;
    return await updateScore(team, delta);
  };

  // Adjust score with a signed delta string like "+300" or "-200"
  const adjustScoreDelta = async (team, deltaStr) => {
    const delta = parseInt(deltaStr, 10);
    if (isNaN(delta)) return { error: "قيمة غير صالحة" };
    return await updateScore(team, delta);
  };

  const resetGame = () => {
    saveSession(null);
    resetTurn();
    setCurrentQuestion(null);
    setRemainingTime(null);
    setSelectedQuestions(new Set());
    setTeamScores({ team1: 0, team2: 0 });
    localStorage.removeItem("hujjah_multi_used");
  };

  return (
    <GameContext.Provider value={{
      session, loading, currentUser, userToken, isGuest, darkMode, gameSettings, currentTurn,
      currentQuestion, setCurrentQuestion,
      remainingTime, setRemainingTime,
      selectedQuestions, markTileUsed, isTileUsed, restoreTile,
      teamScores,
      gameMode, setGameMode,
      tournamentState, setTournament, updateTournament,
      createSession, updateSession, getNextQuestion, updateScore, setExactScore, adjustScoreDelta,
      resetGame, saveSession, loginUser, registerUser, logoutUser, refreshUser,
      playAsGuest,
      toggleDarkMode, switchTurn, setTurn, resetTurn
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
