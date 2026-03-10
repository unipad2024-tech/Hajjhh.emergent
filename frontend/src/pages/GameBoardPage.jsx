import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CAT_ICONS = {
  cat_flags:"🏳️", cat_easy:"💡", cat_saudi:"🇸🇦",
  cat_islamic:"☪️", cat_science:"🔬", cat_logos:"🏷️", cat_word:"🤫",
};
const CAT_BG = {
  cat_flags:  "from-emerald-800 to-emerald-950",
  cat_easy:   "from-sky-800 to-sky-950",
  cat_saudi:  "from-primary to-primary-dark",
  cat_islamic:"from-teal-800 to-teal-950",
  cat_science:"from-violet-800 to-violet-950",
  cat_logos:  "from-orange-800 to-orange-950",
  cat_word:   "from-purple-800 to-purple-950",
};
const DIFF_TEXT = { 200:"text-emerald-300", 400:"text-amber-300", 600:"text-red-400" };
const DIFF_BG   = {
  200: "from-emerald-900/80 to-emerald-950/90",
  400: "from-amber-900/80   to-amber-950/90",
  600: "from-red-900/80     to-red-950/90",
};

/* animated score counter */
function ScoreCounter({ value }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    if (value === prev.current) return;
    setPopping(true);
    const diff = value - prev.current;
    const steps = 12;
    let i = 0;
    const tick = setInterval(() => {
      i++;
      setDisplay(Math.round(prev.current + (diff * i) / steps));
      if (i >= steps) { clearInterval(tick); setDisplay(value); setPopping(false); prev.current = value; }
    }, 40);
    return () => clearInterval(tick);
  }, [value]);

  return (
    <span
      className={`font-black tabular-nums transition-transform inline-block ${popping ? "animate-score-pop text-secondary" : "text-secondary"}`}
    >
      {display}
    </span>
  );
}

/* confetti burst */
function fireConfetti() {
  const colors = ["#F1E194","#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6"];
  for (let i = 0; i < 60; i++) {
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

export default function GameBoardPage() {
  const navigate = useNavigate();
  const { session, resetGame } = useGame();
  const [categories, setCategories] = useState([]);
  const [usedTiles, setUsedTiles] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [clickingTile, setClickingTile] = useState(null);

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    loadBoard();
  }, []);                               // eslint-disable-line

  useEffect(() => {
    if (!session) return;
    setScores({ team1: session.team1_score || 0, team2: session.team2_score || 0 });
    setUsedTiles(new Set(JSON.parse(localStorage.getItem(`used_${session.id}`) || "[]")));
  }, [session]);

  const loadBoard = async () => {
    const allIds = [...(session?.team1_categories||[]), ...(session?.team2_categories||[])];
    const { data: all } = await axios.get(`${API}/categories`);
    setCategories(allIds.map(id => all.find(c => c.id === id)).filter(Boolean));
    setLoading(false);
  };

  const refreshScores = useCallback(async () => {
    if (!session?.id) return;
    try {
      const { data } = await axios.get(`${API}/game/session/${session.id}`);
      setScores({ team1: data.team1_score||0, team2: data.team2_score||0 });
    } catch {}
  }, [session]);

  useEffect(() => {
    const iv = setInterval(refreshScores, 4000);
    return () => clearInterval(iv);
  }, [refreshScores]);

  useEffect(() => {
    const h = () => refreshScores();
    window.addEventListener("scoreUpdated", h);
    return () => window.removeEventListener("scoreUpdated", h);
  }, [refreshScores]);

  const handleTileClick = async (catId, difficulty) => {
    const key = `${catId}_${difficulty}`;
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
        state: { question: q, catId, difficulty, catName: categories.find(c=>c.id===catId)?.name }
      });
    } catch {
      toast.error("لا يوجد أسئلة متاحة!");
    } finally {
      setClickingTile(null);
    }
  };

  const handleEndGame = () => {
    fireConfetti();
    setShowEndConfirm(false);
    setShowWinner(true);
  };

  if (loading) return (
    <div className="min-h-screen game-board-bg flex items-center justify-center">
      <div className="text-secondary/60 text-2xl animate-pulse font-bold">جاري تحميل اللوحة...</div>
    </div>
  );

  const t1Cats = session?.team1_categories || [];
  const t2Cats = session?.team2_categories || [];
  const allUsed = categories.every(c => [200,400,600].every(d => usedTiles.has(`${c.id}_${d}`)));

  const winner =
    allUsed || showWinner
      ? scores.team1 > scores.team2 ? session?.team1_name
      : scores.team2 > scores.team1 ? session?.team2_name
      : "تعادل"
      : null;

  return (
    <div className="min-h-screen flex flex-col" style={{minHeight:"100svh", background:"radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)"}}>

      {/* ── Top Score Bar ── */}
      <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 shrink-0">
        {/* Team 1 */}
        <div
          data-testid="team1-score"
          className="flex flex-col items-center bg-gradient-to-br from-red-900/60 to-red-950/80 border-2 border-red-500/30 rounded-2xl px-3 md:px-6 py-2 md:py-3 min-w-[90px] md:min-w-[140px] shadow-lg"
        >
          <div className="text-red-300 text-xs font-black uppercase tracking-widest mb-0.5 truncate max-w-[110px]">
            🔴 {session?.team1_name}
          </div>
          <div className="text-secondary text-3xl md:text-4xl font-black leading-none">
            <ScoreCounter value={scores.team1} />
          </div>
        </div>

        {/* Center */}
        <div className="text-center flex flex-col items-center gap-1">
          <div
            className="text-secondary font-black text-2xl md:text-4xl animate-winner-glow"
            style={{fontFamily:"Cairo,sans-serif"}}
          >
            حُجّة
          </div>
          <button
            data-testid="end-game-btn"
            onClick={() => setShowEndConfirm(true)}
            className="text-secondary/25 text-[10px] md:text-xs hover:text-secondary/50 transition-colors"
          >
            إنهاء اللعبة
          </button>
        </div>

        {/* Team 2 */}
        <div
          data-testid="team2-score"
          className="flex flex-col items-center bg-gradient-to-br from-blue-900/60 to-blue-950/80 border-2 border-blue-500/30 rounded-2xl px-3 md:px-6 py-2 md:py-3 min-w-[90px] md:min-w-[140px] shadow-lg"
        >
          <div className="text-blue-300 text-xs font-black uppercase tracking-widest mb-0.5 truncate max-w-[110px]">
            🔵 {session?.team2_name}
          </div>
          <div className="text-secondary text-3xl md:text-4xl font-black leading-none">
            <ScoreCounter value={scores.team2} />
          </div>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 px-2 md:px-4 pb-4 overflow-hidden">
        <div
          className="board-grid h-full"
          style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0,1fr))` }}
        >
          {/* Category headers */}
          {categories.map((cat) => {
            const isT1 = t1Cats.includes(cat.id);
            return (
              <div
                key={cat.id}
                className={`bg-gradient-to-br ${CAT_BG[cat.id]||"from-primary to-primary-dark"} rounded-xl p-2 md:p-3 text-center border-2 ${isT1?"border-red-500/40":"border-blue-500/40"} shadow-lg`}
              >
                <div className="text-xl md:text-3xl mb-1">{CAT_ICONS[cat.id]||"🎯"}</div>
                <div className="text-secondary font-black text-[10px] md:text-xs leading-tight">{cat.name}</div>
                <div className={`text-[9px] md:text-[10px] mt-0.5 font-bold truncate ${isT1?"text-red-300":"text-blue-300"}`}>
                  {isT1 ? session?.team1_name : session?.team2_name}
                </div>
              </div>
            );
          })}

          {/* Tiles */}
          {[200,400,600].map(diff =>
            categories.map(cat => {
              const key = `${cat.id}_${diff}`;
              const used = usedTiles.has(key);
              const clicking = clickingTile === key;
              return (
                <button
                  key={key}
                  data-testid={`tile-${cat.id}-${diff}`}
                  onClick={() => handleTileClick(cat.id, diff)}
                  disabled={used || !!clickingTile}
                  className={`tile-btn ${used?"used":""} flex items-center justify-center`}
                  style={{ height: "clamp(52px, 10vw, 80px)" }}
                >
                  {clicking ? (
                    <span className="text-secondary/60 text-lg animate-spin">⏳</span>
                  ) : used ? (
                    <span className="text-secondary/10 text-xl font-black">✗</span>
                  ) : (
                    <span className={`${DIFF_TEXT[diff]} text-xl md:text-3xl font-black`}
                      style={{ textShadow: diff===200?"0 0 10px rgba(52,211,153,0.5)": diff===400?"0 0 10px rgba(251,191,36,0.5)":"0 0 10px rgba(248,113,113,0.5)" }}
                    >
                      {diff}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── All-used auto-banner ── */}
      {allUsed && !showWinner && (
        <div className="fixed bottom-0 inset-x-0 bg-secondary/95 p-5 text-center shadow-2xl border-t-4 border-primary z-40 animate-slide-up">
          <div className="text-primary font-black text-xl md:text-2xl mb-3">
            انتهت اللعبة! {winner === "تعادل" ? "🤝 تعادل!" : `🏆 ${winner} فاز!`}
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-primary border-2 border-secondary/30 rounded-3xl p-8 max-w-sm w-full text-center animate-scale-in">
            <div className="text-secondary text-3xl font-black mb-2">إنهاء اللعبة؟</div>
            <div className="text-secondary/60 mb-6 text-sm">سيتم إعلان الفائز الحالي</div>
            <div className="flex gap-3 justify-center">
              <button onClick={handleEndGame} className="bg-secondary text-primary px-6 py-3 rounded-full font-black hover:scale-105 transition-all">
                نعم، إنهاء
              </button>
              <button onClick={() => setShowEndConfirm(false)} className="border-2 border-secondary/30 text-secondary px-6 py-3 rounded-full font-bold hover:bg-secondary/10 transition-all">
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Winner Screen ── */}
      {showWinner && (
        <div className="fixed inset-0 game-board-bg flex flex-col items-center justify-center z-50 px-6 text-center">
          <div className="text-7xl md:text-9xl mb-4">🏆</div>
          <div className="text-secondary/60 text-lg font-bold mb-2">الفائز</div>
          <div
            className="text-secondary text-5xl md:text-7xl font-black mb-2 animate-winner-glow"
            style={{fontFamily:"Cairo,sans-serif"}}
          >
            {winner === "تعادل" ? "🤝 تعادل!" : winner}
          </div>

          <div className="flex gap-8 mt-6 mb-8">
            <div className="text-center">
              <div className="text-red-300 text-sm font-bold mb-1">{session?.team1_name}</div>
              <div className="text-secondary text-4xl font-black">{scores.team1}</div>
            </div>
            <div className="text-secondary/30 text-3xl flex items-center">VS</div>
            <div className="text-center">
              <div className="text-blue-300 text-sm font-bold mb-1">{session?.team2_name}</div>
              <div className="text-secondary text-4xl font-black">{scores.team2}</div>
            </div>
          </div>

          <button
            onClick={() => { resetGame(); navigate("/"); }}
            className="bg-secondary text-primary px-10 py-4 rounded-full font-black text-xl hover:scale-105 animate-pulse-glow transition-all"
          >
            🎮 لعبة جديدة
          </button>
        </div>
      )}
    </div>
  );
}
