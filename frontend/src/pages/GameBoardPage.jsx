import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DIFFICULTIES = [300, 600, 900];

/* ── Color palettes ── */
const LIGHT = {
  boardBg:   "linear-gradient(155deg, #F3EBD3 0%, #E4D9BB 35%, #C7D3A4 70%, #B5C592 100%)",
  cardBg:    "rgba(255,255,255,0.88)",
  cardBorder:"rgba(0,0,0,0.07)",
  textMain:  "#2C3A1A",
  textSub:   "#5A6A3A",
  scoreBg:   "rgba(44,58,26,0.92)",
  scoreBorder:"rgba(199,211,164,0.25)",
};
const DARK = {
  boardBg:   "linear-gradient(155deg, #1A2B18 0%, #1C2E1A 35%, #1F3020 70%, #172715 100%)",
  cardBg:    "rgba(28,42,26,0.95)",
  cardBorder:"rgba(120,170,90,0.18)",
  textMain:  "#C7D3A4",
  textSub:   "#8AAA68",
  scoreBg:   "rgba(10,20,8,0.95)",
  scoreBorder:"rgba(120,170,90,0.2)",
};

/* ── Score button colors (warm gold palette) ── */
const DIFF_STYLE = {
  300: { bg: "linear-gradient(145deg,#B8860B,#E8C026)", shadow: "rgba(184,134,11,0.55)", darkBg: "linear-gradient(145deg,#9A7010,#C4A01E)" },
  600: { bg: "linear-gradient(145deg,#8B4513,#CD7B3A)", shadow: "rgba(139,69,19,0.55)",  darkBg: "linear-gradient(145deg,#7A3A0F,#B06A2E)" },
  900: { bg: "linear-gradient(145deg,#5B0E14,#9A1E28)", shadow: "rgba(91,14,20,0.55)",   darkBg: "linear-gradient(145deg,#4A0A10,#801820)" },
};

function ScoreCounter({ value, dark }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (value === prev.current) return;
    setPop(true);
    const diff = value - prev.current;
    const steps = 12;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplay(Math.round(prev.current + (diff * i) / steps));
      if (i >= steps) { clearInterval(t); setDisplay(value); setPop(false); prev.current = value; }
    }, 40);
    return () => clearInterval(t);
  }, [value]);

  return (
    <span className={`font-black tabular-nums inline-block transition-transform ${pop ? "scale-125" : ""}`}
      style={{ color: "#F1E194" }}>
      {display}
    </span>
  );
}

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

/* ── Score Button ── */
function ScoreBtn({ catId, diff, slot, used, clicking, onClick, dark }) {
  const ds  = DIFF_STYLE[diff];
  const key = `${catId}_${diff}_${slot}`;
  const isClicking = clicking === key;

  return (
    <button
      data-testid={`tile-${catId}-${diff}-${slot}`}
      onClick={onClick}
      disabled={used || !!clicking}
      className={`
        w-full rounded-full font-black text-center select-none transition-all duration-150
        ${used
          ? "opacity-20 cursor-default"
          : "hover:scale-110 active:scale-95 cursor-pointer hover:-translate-y-0.5"}
      `}
      style={{
        background: used ? (dark ? "rgba(100,120,80,0.2)" : "#d1c9b5") : (dark ? ds.darkBg : ds.bg),
        boxShadow: used ? "none" : `0 5px 14px ${ds.shadow}, 0 2px 6px rgba(0,0,0,0.2)`,
        padding: "clamp(8px,1.5vh,18px) clamp(4px,0.8vw,10px)",
        fontSize: "clamp(1.4rem, 3.2vw, 2.8rem)",
        color: used ? (dark ? "rgba(140,160,100,0.35)" : "rgba(80,80,60,0.35)") : "white",
        letterSpacing: "-0.02em",
        lineHeight: 1,
        border: used ? "none" : "1px solid rgba(255,255,255,0.2)",
      }}
    >
      {isClicking ? "⏳" : used ? "✓" : diff}
    </button>
  );
}

/* ── Category Card ── */
function CategoryCard({ cat, session, usedTiles, clickingTile, onTileClick, dark }) {
  const P = dark ? DARK : LIGHT;
  const t1Cats   = session?.team1_categories || [];
  const isT1     = t1Cats.includes(cat.id);
  const teamName = isT1 ? session?.team1_name : session?.team2_name;
  const teamColor= isT1 ? "#ef4444" : "#3b82f6";

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden transition-all duration-300"
      style={{
        background: P.cardBg,
        border: `2px solid ${P.cardBorder}`,
        boxShadow: dark
          ? "0 4px 20px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)"
          : "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {/* Team indicator strip */}
      <div className="h-1.5 w-full shrink-0" style={{ background: teamColor, opacity: 0.8 }} />

      {/* Content: [left buttons | center image | right buttons] */}
      <div className="flex-1 flex flex-row items-stretch gap-1.5 px-1.5 py-2">

        {/* Left column: slot 1 buttons */}
        <div className="flex flex-col justify-around gap-1.5 shrink-0" style={{ minWidth: "clamp(65px,11vw,140px)" }}>
          {DIFFICULTIES.map(diff => (
            <ScoreBtn
              key={`${cat.id}_${diff}_1`}
              catId={cat.id} diff={diff} slot={1}
              used={usedTiles.has(`${cat.id}_${diff}_1`)}
              clicking={clickingTile}
              onClick={() => onTileClick(cat.id, diff, 1)}
              dark={dark}
            />
          ))}
        </div>

        {/* Center: large image + title */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 py-1">
          <div
            className="rounded-xl overflow-hidden flex items-center justify-center mb-2"
            style={{
              width:  "clamp(90px, 16vw, 230px)",
              height: "clamp(90px, 16vw, 230px)",
              background: `linear-gradient(135deg, ${cat.color || "#5B0E14"}44, ${cat.color || "#5B0E14"}11)`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              flexShrink: 0,
            }}
          >
            {cat.image_url ? (
              <img
                src={cat.image_url}
                alt={cat.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ) : (
              <span style={{ fontSize: "clamp(3rem, 6vw, 5rem)" }}>{cat.icon || "🎯"}</span>
            )}
          </div>

          {/* Category name */}
          <div
            className="font-black text-center leading-tight"
            style={{
              color: P.textMain,
              fontSize: "clamp(0.7rem, 1.6vw, 1.1rem)",
              fontFamily: "Cairo, sans-serif",
              maxWidth: "200px",
            }}
          >
            {cat.name}
          </div>

          {/* Team badge */}
          <div
            className="mt-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${teamColor}18`, color: teamColor, border: `1px solid ${teamColor}33` }}
          >
            {teamName}
          </div>
        </div>

        {/* Right column: slot 2 buttons */}
        <div className="flex flex-col justify-around gap-1.5 shrink-0" style={{ minWidth: "clamp(65px,11vw,140px)" }}>
          {DIFFICULTIES.map(diff => (
            <ScoreBtn
              key={`${cat.id}_${diff}_2`}
              catId={cat.id} diff={diff} slot={2}
              used={usedTiles.has(`${cat.id}_${diff}_2`)}
              clicking={clickingTile}
              onClick={() => onTileClick(cat.id, diff, 2)}
              dark={dark}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════ Main Board ═══ */
export default function GameBoardPage() {
  const navigate = useNavigate();
  const { session, resetGame, darkMode, toggleDarkMode, currentTurn, switchTurn } = useGame();
  const [categories, setCategories]     = useState([]);
  const [usedTiles, setUsedTiles]       = useState(new Set());
  const [loading, setLoading]           = useState(true);
  const [scores, setScores]             = useState({ team1: 0, team2: 0 });
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showWinner, setShowWinner]         = useState(false);
  const [clickingTile, setClickingTile]     = useState(null);

  const P = darkMode ? DARK : LIGHT;

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    loadBoard();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!session) return;
    setScores({ team1: session.team1_score || 0, team2: session.team2_score || 0 });
    setUsedTiles(new Set(JSON.parse(localStorage.getItem(`used_${session.id}`) || "[]")));
  }, [session]);

  const loadBoard = async () => {
    const allIds = [...(session?.team1_categories || []), ...(session?.team2_categories || [])];
    const { data: all } = await axios.get(`${API}/categories`);
    setCategories(allIds.map(id => all.find(c => c.id === id)).filter(Boolean));
    setLoading(false);
  };

  const refreshScores = useCallback(async () => {
    if (!session?.id) return;
    try {
      const { data } = await axios.get(`${API}/game/session/${session.id}`);
      setScores({ team1: data.team1_score || 0, team2: data.team2_score || 0 });
    } catch {}
  }, [session]);

  useEffect(() => { const iv = setInterval(refreshScores, 4000); return () => clearInterval(iv); }, [refreshScores]);
  useEffect(() => {
    const h = () => refreshScores();
    window.addEventListener("scoreUpdated", h);
    return () => window.removeEventListener("scoreUpdated", h);
  }, [refreshScores]);

  const handleTileClick = async (catId, difficulty, slot) => {
    const key = `${catId}_${difficulty}_${slot}`;
    if (usedTiles.has(key) || clickingTile) return;
    setClickingTile(key);
    try {
      const { data: q } = await axios.post(
        `${API}/game/session/${session.id}/question?category_id=${catId}&difficulty=${difficulty}`
      );
      const newUsed = new Set([...usedTiles, key]);
      setUsedTiles(newUsed);
      localStorage.setItem(`used_${session.id}`, JSON.stringify([...newUsed]));
      navigate("/question", {
        state: { question: q, catId, difficulty, slot, catName: categories.find(c => c.id === catId)?.name, turnTeam: currentTurn }
      });
    } catch {
      toast.error("لا يوجد أسئلة متاحة لهذه الفئة!");
    } finally {
      setClickingTile(null);
    }
  };

  const handleEndGame = () => { fireConfetti(); setShowEndConfirm(false); setShowWinner(true); };

  if (loading) return (
    <div className="h-screen flex items-center justify-center" style={{ background: P.boardBg }}>
      <div className="text-xl font-bold animate-pulse" style={{ color: P.textMain }}>جاري تحميل اللوحة...</div>
    </div>
  );

  const allUsed = categories.every(c =>
    DIFFICULTIES.every(d => usedTiles.has(`${c.id}_${d}_1`) && usedTiles.has(`${c.id}_${d}_2`))
  );
  const winner = allUsed || showWinner
    ? scores.team1 > scores.team2 ? session?.team1_name
    : scores.team2 > scores.team1 ? session?.team2_name : "تعادل"
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ minHeight: "100svh", background: P.boardBg }}>

      {/* ── Score Bar ── */}
      <div
        className="shrink-0 flex items-center justify-between px-3 py-2 border-b"
        style={{ background: P.scoreBg, borderColor: P.scoreBorder }}
      >
        {/* Team 1 */}
        <div
          data-testid="team1-score"
          className="flex items-center gap-2 rounded-2xl px-3 py-1.5"
          style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}
        >
          <span className="text-red-300 text-xs font-black truncate max-w-[80px] hidden sm:block">
            🔴 {session?.team1_name}
          </span>
          <span className="text-red-300 text-xs sm:hidden">🔴</span>
          <span className="text-2xl md:text-3xl font-black">
            <ScoreCounter value={scores.team1} dark={darkMode} />
          </span>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-yellow-200 font-black text-xl" style={{ fontFamily: "Cairo, sans-serif" }}>
            حُجّة
          </div>
          {/* Turn Indicator */}
          <div
            data-testid="turn-indicator"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-xs transition-all duration-500"
            style={{
              background: currentTurn === 1 ? "rgba(239,68,68,0.25)" : "rgba(59,130,246,0.25)",
              border: `1.5px solid ${currentTurn === 1 ? "rgba(239,68,68,0.6)" : "rgba(59,130,246,0.6)"}`,
              color: currentTurn === 1 ? "#fca5a5" : "#93c5fd",
            }}
          >
            <span>{currentTurn === 1 ? "🔴" : "🔵"}</span>
            <span>دور {currentTurn === 1 ? session?.team1_name : session?.team2_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button
              data-testid="dark-mode-toggle"
              onClick={toggleDarkMode}
              title={darkMode ? "الوضع الفاتح" : "الوضع الداكن"}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-200"
              style={{
                background: darkMode ? "rgba(120,170,90,0.25)" : "rgba(200,200,150,0.2)",
                color: darkMode ? "#C7D3A4" : "#F1E194",
                border: `1px solid ${darkMode ? "rgba(120,170,90,0.3)" : "rgba(241,225,148,0.2)"}`,
              }}
            >
              {darkMode ? "☀️ فاتح" : "🌙 داكن"}
            </button>
            <button
              data-testid="end-game-btn"
              onClick={() => setShowEndConfirm(true)}
              className="text-yellow-200/30 text-[10px] hover:text-yellow-200/60 transition-colors"
            >
              إنهاء
            </button>
          </div>
        </div>

        {/* Team 2 */}
        <div
          data-testid="team2-score"
          className="flex items-center gap-2 rounded-2xl px-3 py-1.5"
          style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}
        >
          <span className="text-2xl md:text-3xl font-black">
            <ScoreCounter value={scores.team2} dark={darkMode} />
          </span>
          <span className="text-blue-300 text-xs font-black truncate max-w-[80px] hidden sm:block">
            {session?.team2_name} 🔵
          </span>
          <span className="text-blue-300 text-xs sm:hidden">🔵</span>
        </div>
      </div>

      {/* ── Game Board: 2×3 grid ── */}
      <div
        className="flex-1 p-2 md:p-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: "clamp(6px, 1.2vw, 16px)",
          overflow: "hidden",
        }}
      >
        {categories.slice(0, 6).map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            session={session}
            usedTiles={usedTiles}
            clickingTile={clickingTile}
            onTileClick={handleTileClick}
            dark={darkMode}
          />
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="shrink-0 flex justify-center gap-6 pb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-red-500/60" />
          <span className="text-xs font-bold" style={{ color: P.textSub }}>{session?.team1_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-blue-500/60" />
          <span className="text-xs font-bold" style={{ color: P.textSub }}>{session?.team2_name}</span>
        </div>
      </div>

      {/* ── All-used banner ── */}
      {allUsed && !showWinner && (
        <div
          className="fixed bottom-0 inset-x-0 p-4 text-center z-40 border-t-4"
          style={{ background: "#F1E194", borderColor: "#5B0E14" }}
        >
          <div className="text-primary font-black text-xl mb-3">
            {winner === "تعادل" ? "🤝 تعادل!" : `🏆 ${winner} فاز!`}
          </div>
          <button
            onClick={() => { fireConfetti(); setShowWinner(true); }}
            className="bg-primary text-secondary px-8 py-3 rounded-full font-black text-lg hover:scale-105 transition-all"
          >
            عرض النتيجة النهائية
          </button>
        </div>
      )}

      {/* ── End Confirm ── */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center animate-scale-in shadow-2xl">
            <div className="text-2xl font-black mb-2 text-primary">إنهاء اللعبة؟</div>
            <div className="text-gray-500 mb-6 text-sm">سيتم إعلان الفائز الحالي</div>
            <div className="flex gap-3 justify-center">
              <button onClick={handleEndGame} className="bg-primary text-secondary px-6 py-3 rounded-full font-black hover:scale-105 transition-all">
                نعم، إنهاء
              </button>
              <button onClick={() => setShowEndConfirm(false)} className="border-2 border-gray-200 text-gray-500 px-6 py-3 rounded-full font-bold hover:bg-gray-50 transition-all">
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Winner Screen ── */}
      {showWinner && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 px-6 text-center" style={{ background: P.boardBg }}>
          <div className="text-7xl md:text-9xl mb-4">🏆</div>
          <div className="text-lg font-bold mb-2" style={{ color: P.textMain, opacity: 0.6 }}>الفائز</div>
          <div
            className="text-5xl md:text-7xl font-black mb-4 animate-winner-glow"
            style={{ color: "#5B0E14", fontFamily: "Cairo,sans-serif", textShadow: "0 4px 20px rgba(91,14,20,0.3)" }}
          >
            {winner === "تعادل" ? "🤝 تعادل!" : winner}
          </div>
          <div className="flex gap-8 mb-8">
            <div className="text-center rounded-2xl px-6 py-4" style={{ background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)" }}>
              <div className="text-red-500 text-sm font-bold mb-1">{session?.team1_name}</div>
              <div className="text-3xl font-black" style={{ color: P.textMain }}>{scores.team1}</div>
            </div>
            <div className="flex items-center text-gray-400 text-xl">VS</div>
            <div className="text-center rounded-2xl px-6 py-4" style={{ background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)" }}>
              <div className="text-blue-500 text-sm font-bold mb-1">{session?.team2_name}</div>
              <div className="text-3xl font-black" style={{ color: P.textMain }}>{scores.team2}</div>
            </div>
          </div>
          <button
            onClick={() => { resetGame(); navigate("/"); }}
            className="bg-primary text-secondary px-10 py-4 rounded-full font-black text-xl hover:scale-105 animate-pulse-glow transition-all"
          >
            🎮 لعبة جديدة
          </button>
        </div>
      )}
    </div>
  );
}
