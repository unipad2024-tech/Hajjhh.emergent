import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DIFFICULTIES = [200, 400, 600];

const DIFF_STYLE = {
  200: { text: "text-emerald-300", glow: "rgba(52,211,153,0.6)", border: "border-emerald-600/30" },
  400: { text: "text-amber-300",   glow: "rgba(251,191,36,0.6)",  border: "border-amber-600/30" },
  600: { text: "text-red-400",     glow: "rgba(248,113,113,0.6)", border: "border-red-600/30" },
};

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
    <span className={`font-black tabular-nums inline-block transition-transform ${popping ? "scale-125 text-secondary" : "text-secondary"}`}>
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
        state: { question: q, catId, difficulty, slot, catName: categories.find(c => c.id === catId)?.name }
      });
    } catch {
      toast.error("لا يوجد أسئلة متاحة لهذه الفئة!");
    } finally {
      setClickingTile(null);
    }
  };

  const handleEndGame = () => { fireConfetti(); setShowEndConfirm(false); setShowWinner(true); };

  if (loading) return (
    <div className="h-screen flex items-center justify-center" style={{ background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" }}>
      <div className="text-secondary/60 text-2xl animate-pulse font-bold">جاري تحميل اللوحة...</div>
    </div>
  );

  const t1Cats = session?.team1_categories || [];
  const allUsed = categories.every(c =>
    DIFFICULTIES.every(d => usedTiles.has(`${c.id}_${d}_1`) && usedTiles.has(`${c.id}_${d}_2`))
  );
  const winner = allUsed || showWinner
    ? scores.team1 > scores.team2 ? session?.team1_name
    : scores.team2 > scores.team1 ? session?.team2_name : "تعادل"
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ minHeight: "100svh", background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" }}>

      {/* ── Score Bar ── */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-secondary/10">
        {/* Team 1 */}
        <div data-testid="team1-score" className="flex items-center gap-2 bg-red-950/60 border border-red-500/30 rounded-2xl px-3 md:px-5 py-2">
          <span className="text-red-300 text-xs font-black hidden md:block">🔴 {session?.team1_name}</span>
          <span className="text-red-300 text-xs font-black md:hidden">🔴</span>
          <span className="text-secondary text-2xl md:text-3xl font-black"><ScoreCounter value={scores.team1} /></span>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-secondary font-black text-xl md:text-2xl" style={{ fontFamily: "Cairo,sans-serif" }}>
            حُجّة
          </div>
          <button data-testid="end-game-btn" onClick={() => setShowEndConfirm(true)}
            className="text-secondary/25 text-[10px] hover:text-secondary/50 transition-colors">
            إنهاء اللعبة
          </button>
        </div>

        {/* Team 2 */}
        <div data-testid="team2-score" className="flex items-center gap-2 bg-blue-950/60 border border-blue-500/30 rounded-2xl px-3 md:px-5 py-2">
          <span className="text-secondary text-2xl md:text-3xl font-black"><ScoreCounter value={scores.team2} /></span>
          <span className="text-blue-300 text-xs font-black hidden md:block">{session?.team2_name} 🔵</span>
          <span className="text-blue-300 text-xs font-black md:hidden">🔵</span>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 p-1 md:p-2 overflow-hidden">
        <div
          className="h-full"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))`,
            gridTemplateRows: `auto repeat(3, 1fr)`,
            gap: "3px",
          }}
        >
          {/* ── Category Headers ── */}
          {categories.map((cat) => {
            const isT1 = t1Cats.includes(cat.id);
            return (
              <div
                key={cat.id}
                className="relative rounded-xl overflow-hidden flex flex-col items-center justify-end"
                style={{
                  border: `2px solid ${isT1 ? "rgba(239,68,68,0.4)" : "rgba(59,130,246,0.4)"}`,
                  minHeight: "clamp(55px, 10vw, 90px)",
                }}
              >
                {/* Background image */}
                {cat.image_url ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${cat.image_url})` }}
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${cat.color || "#5B0E14"}, #0f0102)` }} />
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50" />
                {/* Content */}
                <div className="relative z-10 text-center px-1 pb-1.5 w-full">
                  <div className="text-secondary font-black text-[10px] md:text-sm leading-tight drop-shadow-lg">
                    {cat.name}
                  </div>
                  <div className={`text-[8px] md:text-[10px] font-bold ${isT1 ? "text-red-300" : "text-blue-300"}`}>
                    {isT1 ? session?.team1_name : session?.team2_name}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Tile Rows: 3 difficulties × 6 categories, each cell = 2 tiles (A|B) ── */}
          {DIFFICULTIES.flatMap(diff =>
            categories.map(cat => {
              const ds = DIFF_STYLE[diff];
              const slot1Used = usedTiles.has(`${cat.id}_${diff}_1`);
              const slot2Used = usedTiles.has(`${cat.id}_${diff}_2`);

              return (
                <div key={`${cat.id}_${diff}`} className="flex gap-0.5 md:gap-1">
                  {/* Team A tile */}
                  <button
                    key={`${cat.id}_${diff}_1`}
                    data-testid={`tile-${cat.id}-${diff}-1`}
                    onClick={() => handleTileClick(cat.id, diff, 1)}
                    disabled={slot1Used || !!clickingTile}
                    className={`
                      flex-1 flex items-center justify-center rounded-lg border
                      transition-all duration-150 select-none
                      ${slot1Used
                        ? "bg-secondary/5 border-secondary/8 cursor-default opacity-40"
                        : `bg-gradient-to-br from-red-950/50 to-black/80 border-red-700/20
                           hover:from-red-900/70 hover:border-red-500/50 hover:scale-[1.04]
                           active:scale-95 cursor-pointer`
                      }
                    `}
                  >
                    {clickingTile === `${cat.id}_${diff}_1` ? (
                      <span className="text-secondary/40 text-sm animate-spin">⏳</span>
                    ) : slot1Used ? (
                      <span className="text-red-900/50 text-lg font-black">✗</span>
                    ) : (
                      <span
                        className={`${ds.text} font-black`}
                        style={{
                          fontSize: "clamp(0.9rem, 2.2vw, 1.6rem)",
                          textShadow: `0 0 12px ${ds.glow}`,
                        }}
                      >
                        {diff}
                      </span>
                    )}
                  </button>

                  {/* Team B tile */}
                  <button
                    key={`${cat.id}_${diff}_2`}
                    data-testid={`tile-${cat.id}-${diff}-2`}
                    onClick={() => handleTileClick(cat.id, diff, 2)}
                    disabled={slot2Used || !!clickingTile}
                    className={`
                      flex-1 flex items-center justify-center rounded-lg border
                      transition-all duration-150 select-none
                      ${slot2Used
                        ? "bg-secondary/5 border-secondary/8 cursor-default opacity-40"
                        : `bg-gradient-to-br from-blue-950/50 to-black/80 border-blue-700/20
                           hover:from-blue-900/70 hover:border-blue-500/50 hover:scale-[1.04]
                           active:scale-95 cursor-pointer`
                      }
                    `}
                  >
                    {clickingTile === `${cat.id}_${diff}_2` ? (
                      <span className="text-secondary/40 text-sm animate-spin">⏳</span>
                    ) : slot2Used ? (
                      <span className="text-blue-900/50 text-lg font-black">✗</span>
                    ) : (
                      <span
                        className={`${ds.text} font-black`}
                        style={{
                          fontSize: "clamp(0.9rem, 2.2vw, 1.6rem)",
                          textShadow: `0 0 12px ${ds.glow}`,
                        }}
                      >
                        {diff}
                      </span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Team Legend ── */}
      <div className="flex justify-center gap-6 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-700/50 border border-red-500/40" />
          <span className="text-red-300/70 text-xs font-bold">{session?.team1_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-700/50 border border-blue-500/40" />
          <span className="text-blue-300/70 text-xs font-bold">{session?.team2_name}</span>
        </div>
      </div>

      {/* ── All-used Banner ── */}
      {allUsed && !showWinner && (
        <div className="fixed bottom-0 inset-x-0 bg-secondary/95 p-4 text-center shadow-2xl border-t-4 border-primary z-40 animate-slide-up">
          <div className="text-primary font-black text-xl mb-3">
            انتهت اللعبة! {winner === "تعادل" ? "🤝 تعادل!" : `🏆 ${winner} فاز!`}
          </div>
          <button onClick={() => { fireConfetti(); setShowWinner(true); }}
            className="bg-primary text-secondary px-8 py-3 rounded-full font-black text-lg hover:scale-105 transition-all">
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
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 px-6 text-center" style={{ background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" }}>
          <div className="text-7xl md:text-9xl mb-4">🏆</div>
          <div className="text-secondary/60 text-lg font-bold mb-2">الفائز</div>
          <div className="text-secondary text-5xl md:text-7xl font-black mb-2 animate-winner-glow" style={{ fontFamily: "Cairo,sans-serif" }}>
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
          <button onClick={() => { resetGame(); navigate("/"); }}
            className="bg-secondary text-primary px-10 py-4 rounded-full font-black text-xl hover:scale-105 animate-pulse-glow transition-all">
            🎮 لعبة جديدة
          </button>
        </div>
      )}
    </div>
  );
}
