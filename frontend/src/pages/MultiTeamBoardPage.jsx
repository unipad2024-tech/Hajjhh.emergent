import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DIFFICULTIES = [300, 600, 900];

const DIFF_STYLE = {
  300: { bg: "linear-gradient(145deg,#B8860B,#E8C026)", shadow: "rgba(184,134,11,0.55)" },
  600: { bg: "linear-gradient(145deg,#8B4513,#CD7B3A)", shadow: "rgba(139,69,19,0.55)" },
  900: { bg: "linear-gradient(145deg,#5B0E14,#9A1E28)", shadow: "rgba(91,14,20,0.55)" },
};

function fireConfetti() {
  const colors = ["#F1E194","#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6"];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.left = Math.random() * 100 + "vw";
    el.style.width = (Math.random() * 10 + 5) + "px";
    el.style.height = (Math.random() * 10 + 5) + "px";
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
    el.style.animationDuration = (Math.random() * 3 + 2) + "s";
    el.style.animationDelay = Math.random() * 1 + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

export default function MultiTeamBoardPage() {
  const navigate = useNavigate();
  const {
    multiTeams, multiScores, adjustMultiScore, setMultiScoreExact,
    session, currentTurn, setTurn, resetGame
  } = useGame();

  const [usedTiles, setUsedTiles] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("hujjah_multi_used") || "[]")); }
    catch { return new Set(); }
  });
  const [clickingTile, setClickingTile] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [gmpOpen, setGmpOpen] = useState(false);
  const [adjTeam, setAdjTeam] = useState(null);
  const [editScore, setEditScore] = useState(null); // teamId being edited
  const [editVal, setEditVal] = useState("");

  useEffect(() => {
    if (!multiTeams?.length) { navigate("/mode"); return; }
    if (adjTeam === null && multiTeams.length > 0) setAdjTeam(multiTeams[0].id);
  }, [multiTeams, navigate]); // eslint-disable-line

  const currentTeam = multiTeams[currentTurn - 1] || multiTeams[0];

  const markTile = useCallback((key) => {
    setUsedTiles(prev => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem("hujjah_multi_used", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleTileClick = async (team, diff, slot) => {
    const key = `${team.id}_${diff}_${slot}`;
    if (usedTiles.has(key) || clickingTile) return;
    setClickingTile(key);
    markTile(key);
    try {
      const { data: q } = await axios.post(
        `${API}/game/session/${session.id}/question?category_id=${team.categoryId}&difficulty=${diff}`
      );
      navigate("/question", {
        state: { question: q, catId: team.categoryId, difficulty: diff, slot, catName: team.categoryName, turnTeam: currentTurn, multiMode: true },
      });
    } catch {
      toast.error("لا يوجد أسئلة متاحة!");
    } finally {
      setClickingTile(null);
    }
  };

  const allUsed = multiTeams.every(t =>
    DIFFICULTIES.every(d => usedTiles.has(`${t.id}_${d}_1`) && usedTiles.has(`${t.id}_${d}_2`))
  );

  const getWinner = () => {
    if (!multiTeams.length) return null;
    let best = multiTeams[0];
    multiTeams.forEach(t => {
      if ((multiScores[t.id] || 0) > (multiScores[best.id] || 0)) best = t;
    });
    const maxScore = multiScores[best.id] || 0;
    const tied = multiTeams.filter(t => (multiScores[t.id] || 0) === maxScore);
    return tied.length > 1 ? null : best;
  };

  if (!multiTeams?.length) return null;

  const winner = getWinner();
  const BOARD_BG = "linear-gradient(155deg, #1A2B18 0%, #1C2E1A 35%, #1F3020 70%, #172715 100%)";

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ minHeight: "100svh", background: BOARD_BG }}>

      {/* ── Score Bar ── */}
      <div
        className="shrink-0 px-2 py-2 border-b"
        style={{ background: "rgba(8,16,6,0.97)", borderColor: "rgba(120,170,90,0.18)" }}
      >
        <div className="flex items-center gap-2">
          {/* Team score blocks */}
          <div className="flex-1 flex gap-1.5 overflow-x-auto">
            {multiTeams.map((team) => {
              const isActive = currentTeam?.id === team.id;
              return (
                <div
                  key={team.id}
                  data-testid={`multi-score-${team.id}`}
                  className="flex-1 flex flex-col items-center rounded-2xl px-2 py-1.5 min-w-0 transition-all duration-300"
                  style={{
                    background: isActive ? `${team.color}22` : `${team.color}0A`,
                    border: `2px solid ${isActive ? team.color : team.color + "28"}`,
                    boxShadow: isActive ? `0 0 18px ${team.color}44` : "none",
                  }}
                >
                  <span
                    className="font-black truncate w-full text-center"
                    style={{ color: team.color, fontSize: "clamp(0.75rem,1.6vw,1.1rem)" }}
                  >
                    {team.icon} {team.name}
                  </span>
                  <span
                    className="font-black tabular-nums"
                    style={{ color: "#F1E194", fontSize: "clamp(1.6rem,3.5vw,2.8rem)", lineHeight: 1.1 }}
                  >
                    {multiScores[team.id] || 0}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Center controls */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <div
              className="font-black text-yellow-200 text-sm leading-none"
              style={{ fontFamily: "Cairo, sans-serif" }}
            >
              حُجّة
            </div>
            <div
              data-testid="multi-turn-indicator"
              className="rounded-xl px-3 py-1 font-black text-center text-sm"
              style={{
                background: currentTeam ? `${currentTeam.color}33` : "transparent",
                border: `2px solid ${currentTeam?.color || "#ccc"}`,
                color: currentTeam?.color || "#fff",
                animation: "pulse 1.8s ease-in-out infinite",
                whiteSpace: "nowrap",
              }}
            >
              دور {currentTeam?.name}
            </div>
            <button
              onClick={() => setShowEndConfirm(true)}
              className="text-secondary/30 hover:text-secondary/60 text-xs font-bold transition-colors"
            >
              إنهاء
            </button>
          </div>
        </div>
      </div>

      {/* ── Board: N columns ── */}
      <div
        className="flex-1 p-2 md:p-3 overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${multiTeams.length}, 1fr)`,
          gap: "clamp(5px,1vw,12px)",
        }}
      >
        {multiTeams.map((team) => (
          <div
            key={team.id}
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: "rgba(28,42,26,0.95)",
              border: `2px solid ${team.color}28`,
              boxShadow: currentTeam?.id === team.id ? `0 0 20px ${team.color}33` : "none",
            }}
          >
            {/* Color strip */}
            <div className="h-1.5 shrink-0" style={{ background: team.color }} />

            {/* Column header */}
            <div
              className="px-2 py-2 text-center border-b"
              style={{ borderColor: `${team.color}20` }}
            >
              <div
                className="font-black"
                style={{ color: team.color, fontSize: "clamp(0.9rem,1.8vw,1.3rem)", fontFamily: "Cairo, sans-serif" }}
              >
                {team.icon} {team.name}
              </div>
              <div style={{ color: "#8AAA68", fontSize: "0.65rem", fontWeight: 600 }}>
                {team.categoryName}
              </div>
            </div>

            {/* Difficulty tiles */}
            <div className="flex-1 flex flex-col justify-around px-2 py-2 gap-1.5">
              {DIFFICULTIES.map(diff => {
                const ds = DIFF_STYLE[diff];
                return (
                  <div key={diff} className="flex gap-1.5">
                    {[1, 2].map(slot => {
                      const key = `${team.id}_${diff}_${slot}`;
                      const used = usedTiles.has(key);
                      const isClicking = clickingTile === key;
                      return (
                        <button
                          key={slot}
                          data-testid={`multi-tile-${team.id}-${diff}-${slot}`}
                          onClick={() => handleTileClick(team, diff, slot)}
                          disabled={used || !!clickingTile}
                          className="flex-1 rounded-xl font-black text-center transition-all duration-150 hover:scale-110 active:scale-95 disabled:cursor-default"
                          style={{
                            background: used ? "rgba(80,100,60,0.2)" : ds.bg,
                            boxShadow: used ? "none" : `0 4px 12px ${ds.shadow}`,
                            padding: "clamp(8px,1.5vh,18px) 4px",
                            fontSize: "clamp(1.2rem,2.8vw,2.2rem)",
                            color: used ? "rgba(140,160,100,0.25)" : "white",
                            border: used ? "none" : "1px solid rgba(255,255,255,0.15)",
                          }}
                        >
                          {isClicking ? "⏳" : used ? "✓" : diff}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Game Master Button ── */}
      <button
        data-testid="multi-gmp-btn"
        onClick={() => setGmpOpen(o => !o)}
        className="fixed z-[10000] flex items-center gap-2 rounded-2xl font-black shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{
          bottom: "clamp(16px,2.5vh,28px)",
          right: "clamp(16px,2vw,28px)",
          background: gmpOpen ? "linear-gradient(135deg,#5B0E14,#8B1520)" : "linear-gradient(135deg,rgba(91,14,20,0.95),rgba(139,21,32,0.95))",
          border: "2px solid rgba(241,225,148,0.45)",
          color: "#F1E194",
          padding: "clamp(10px,1.5vh,16px) clamp(16px,2.2vw,28px)",
          boxShadow: "0 6px 32px rgba(91,14,20,0.65)",
          minWidth: "clamp(140px,14vw,180px)",
        }}
      >
        <span style={{ fontSize: "1.1rem" }}>⚙</span>
        <span style={{ fontSize: "0.9rem" }}>{gmpOpen ? "إغلاق" : "لوحة المضيف"}</span>
      </button>

      {/* ── Game Master Panel ── */}
      {gmpOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-end p-4 pb-24"
          onClick={e => { if (e.target === e.currentTarget) setGmpOpen(false); }}
        >
          <div
            className="rounded-3xl p-4 w-80 max-h-[80vh] overflow-y-auto"
            style={{ background: "rgba(8,16,6,0.98)", border: "2px solid rgba(120,170,90,0.2)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-black text-secondary text-base">⚙ لوحة المضيف</span>
              <button onClick={() => setGmpOpen(false)} className="text-secondary/40 hover:text-secondary text-lg">✕</button>
            </div>

            {/* Score Edit */}
            <div
              className="rounded-2xl p-3 mb-3"
              style={{ background: "rgba(28,42,26,0.8)", border: "1px solid rgba(120,170,90,0.15)" }}
            >
              <div className="text-secondary/55 text-xs font-black mb-2">تعديل النقاط مباشرة</div>
              <div className="grid grid-cols-2 gap-1.5">
                {multiTeams.map(t => (
                  <div key={t.id}>
                    {editScore === t.id ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          autoFocus
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              const v = parseInt(editVal, 10);
                              if (!isNaN(v)) { setMultiScoreExact(t.id, v); toast.success("تم التحديث"); }
                              setEditScore(null);
                            }
                            if (e.key === "Escape") setEditScore(null);
                          }}
                          className="w-full rounded-lg px-2 py-1 font-black text-center outline-none text-sm"
                          style={{ background: `${t.color}18`, border: `1px solid ${t.color}`, color: "#F1E194" }}
                          placeholder={String(multiScores[t.id] || 0)}
                        />
                        <button
                          onClick={() => {
                            const v = parseInt(editVal, 10);
                            if (!isNaN(v)) { setMultiScoreExact(t.id, v); toast.success("تم التحديث"); }
                            setEditScore(null);
                          }}
                          className="rounded-lg px-2 font-black text-white text-xs"
                          style={{ background: t.color }}
                        >✓</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditScore(t.id); setEditVal(String(multiScores[t.id] || 0)); }}
                        className="w-full rounded-xl py-2 font-black text-center transition-all hover:scale-105 text-sm"
                        style={{ background: `${t.color}18`, border: `2px solid ${t.color}44`, color: t.color }}
                      >
                        <div style={{ fontSize: "0.7rem" }}>{t.name}</div>
                        <div style={{ fontSize: "1.3rem" }}>{multiScores[t.id] || 0}</div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Score Adjust */}
            <div
              className="rounded-2xl p-3 mb-3"
              style={{ background: "rgba(28,42,26,0.8)", border: "1px solid rgba(120,170,90,0.15)" }}
            >
              <div className="text-secondary/55 text-xs font-black mb-2">إضافة / خصم</div>
              <div className="flex gap-1.5 mb-2">
                {multiTeams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAdjTeam(t.id)}
                    className="flex-1 py-1.5 rounded-xl font-black text-xs transition-all"
                    style={{
                      background: adjTeam === t.id ? t.color : `${t.color}18`,
                      border: `1.5px solid ${t.color}`,
                      color: adjTeam === t.id ? "white" : t.color,
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[300, 600, 900].map(v => (
                  <button key={`+${v}`}
                    onClick={() => {
                      if (!adjTeam) return;
                      adjustMultiScore(adjTeam, v);
                      const name = multiTeams.find(t => t.id === adjTeam)?.name;
                      toast.success(`+${v} ← ${name}`, { duration: 1500 });
                    }}
                    className="py-1.5 rounded-xl font-black text-xs transition-all hover:scale-105"
                    style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80" }}
                  >+{v}</button>
                ))}
                {[300, 600, 900].map(v => (
                  <button key={`-${v}`}
                    onClick={() => {
                      if (!adjTeam) return;
                      adjustMultiScore(adjTeam, -v);
                      const name = multiTeams.find(t => t.id === adjTeam)?.name;
                      toast.success(`-${v} ← ${name}`, { duration: 1500 });
                    }}
                    className="py-1.5 rounded-xl font-black text-xs transition-all hover:scale-105"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}
                  >-{v}</button>
                ))}
              </div>
            </div>

            {/* Turn control */}
            <div
              className="rounded-2xl p-3"
              style={{ background: "rgba(28,42,26,0.8)", border: "1px solid rgba(120,170,90,0.15)" }}
            >
              <div className="text-secondary/55 text-xs font-black mb-2">تغيير الدور</div>
              <div className="grid grid-cols-2 gap-1.5">
                {multiTeams.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => { setTurn(i + 1); toast.success(`دور ${t.name}`, { duration: 1000 }); }}
                    className="py-2 rounded-xl font-black text-xs transition-all hover:scale-105"
                    style={{
                      background: currentTurn === i + 1 ? t.color : `${t.color}18`,
                      border: `1.5px solid ${t.color}`,
                      color: currentTurn === i + 1 ? "white" : t.color,
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── End Confirm ── */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-2xl font-black mb-4 text-primary">إنهاء اللعبة؟</div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { fireConfetti(); setShowEndConfirm(false); setShowWinner(true); }}
                className="bg-primary text-secondary px-6 py-3 rounded-full font-black hover:scale-105 transition-all"
              >
                نعم
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="border-2 border-gray-200 text-gray-500 px-6 py-3 rounded-full font-bold"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Winner Screen ── */}
      {(showWinner || allUsed) && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center z-50 px-6 text-center"
          style={{ background: BOARD_BG }}
        >
          <div className="text-8xl mb-4">🏆</div>
          <div className="text-secondary/55 font-bold mb-2">الفائز</div>
          <div
            className="text-5xl font-black mb-6"
            style={{ color: winner?.color || "#F1E194", fontFamily: "Cairo" }}
          >
            {winner ? winner.name : "🤝 تعادل!"}
          </div>
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {multiTeams.map(t => (
              <div
                key={t.id}
                className="text-center rounded-2xl px-5 py-3"
                style={{ background: `${t.color}18`, border: `2px solid ${t.color}44` }}
              >
                <div className="font-bold text-sm mb-0.5" style={{ color: t.color }}>{t.icon} {t.name}</div>
                <div className="text-2xl font-black" style={{ color: "#F1E194" }}>{multiScores[t.id] || 0}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { resetGame(); navigate("/"); }}
            className="bg-secondary text-primary px-10 py-4 rounded-full font-black text-xl hover:scale-105 transition-all"
          >
            🎮 لعبة جديدة
          </button>
        </div>
      )}
    </div>
  );
}
