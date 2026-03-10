import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_ICONS = {
  cat_flags: "🏳️", cat_easy: "💡", cat_saudi: "🇸🇦",
  cat_islamic: "☪️", cat_science: "🔬", cat_logos: "🏷️", cat_word: "🤫",
};

const DIFFICULTY_COLORS = {
  200: "from-green-700/80 to-green-900/80",
  400: "from-amber-700/80 to-amber-900/80",
  600: "from-red-700/80 to-red-900/80",
};

export default function GameBoardPage() {
  const navigate = useNavigate();
  const { session, resetGame } = useGame();
  const [categories, setCategories] = useState([]);
  const [usedTiles, setUsedTiles] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    loadBoard();
  }, [session]);

  useEffect(() => {
    if (session) {
      setScores({ team1: session.team1_score || 0, team2: session.team2_score || 0 });
      setUsedTiles(new Set(JSON.parse(localStorage.getItem(`used_${session.id}`) || "[]")));
    }
  }, [session]);

  const loadBoard = async () => {
    if (!session) return;
    const allCatIds = [...(session.team1_categories || []), ...(session.team2_categories || [])];
    const { data: allCats } = await axios.get(`${API}/categories`);
    const boardCats = allCatIds.map(id => allCats.find(c => c.id === id)).filter(Boolean);
    setCategories(boardCats);
    setLoading(false);
  };

  const handleTileClick = async (catId, difficulty) => {
    const key = `${catId}_${difficulty}`;
    if (usedTiles.has(key)) { toast.error("هذا السؤال استُخدم!"); return; }

    try {
      const { data: question } = await axios.post(
        `${API}/game/session/${session.id}/question?category_id=${catId}&difficulty=${difficulty}`
      );

      const newUsed = new Set([...usedTiles, key]);
      setUsedTiles(newUsed);
      localStorage.setItem(`used_${session.id}`, JSON.stringify([...newUsed]));

      navigate("/question", { state: { question, catId, difficulty, catName: categories.find(c => c.id === catId)?.name } });
    } catch (e) {
      toast.error("لا يوجد أسئلة متاحة لهذه الفئة والمستوى!");
    }
  };

  const refreshScores = useCallback(async () => {
    if (!session?.id) return;
    try {
      const { data } = await axios.get(`${API}/game/session/${session.id}`);
      setScores({ team1: data.team1_score || 0, team2: data.team2_score || 0 });
    } catch (e) {}
  }, [session]);

  useEffect(() => {
    const interval = setInterval(refreshScores, 3000);
    return () => clearInterval(interval);
  }, [refreshScores]);

  // Listen for score updates from question page
  useEffect(() => {
    const handler = () => refreshScores();
    window.addEventListener("scoreUpdated", handler);
    return () => window.removeEventListener("scoreUpdated", handler);
  }, [refreshScores]);

  if (loading) return (
    <div className="min-h-screen game-board-bg flex items-center justify-center">
      <div className="text-secondary text-2xl animate-pulse">جاري تحميل اللوحة...</div>
    </div>
  );

  const team1Cats = session?.team1_categories || [];
  const team2Cats = session?.team2_categories || [];
  const allCatIds = [...team1Cats, ...team2Cats];
  const allUsed = allCatIds.every(catId =>
    [200, 400, 600].every(d => usedTiles.has(`${catId}_${d}`))
  );

  return (
    <div className="min-h-screen game-board-bg pattern-overlay px-2 py-4 md:px-4 md:py-6">
      {/* Top Score Bar */}
      <div className="flex items-center justify-between mb-6 max-w-6xl mx-auto">
        {/* Team 1 Score */}
        <div data-testid="team1-score" className="bg-primary/80 border border-secondary/30 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-center min-w-[100px] md:min-w-[140px]">
          <div className="text-secondary/70 text-xs font-bold mb-1 truncate max-w-[100px]">{session?.team1_name}</div>
          <div className="text-secondary text-3xl font-black">{scores.team1}</div>
        </div>

        {/* Center Logo */}
        <div className="text-center">
          <div className="text-secondary text-4xl font-black" style={{ textShadow: "0 0 20px rgba(241,225,148,0.5)" }}>
            حُجّة
          </div>
          <button
            data-testid="end-game-btn"
            onClick={() => setShowEndConfirm(true)}
            className="text-secondary/30 text-xs mt-1 hover:text-secondary/60 transition-colors"
          >
            إنهاء اللعبة
          </button>
        </div>

        {/* Team 2 Score */}
        <div data-testid="team2-score" className="bg-primary/80 border border-secondary/30 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-center min-w-[100px] md:min-w-[140px]">
          <div className="text-secondary/70 text-xs font-bold mb-1 truncate max-w-[100px]">{session?.team2_name}</div>
          <div className="text-secondary text-3xl font-black">{scores.team2}</div>
        </div>
      </div>

      {/* Game Board Grid */}
      <div className="max-w-6xl mx-auto overflow-x-auto">
        <div className="min-w-[500px]" style={{ display: "grid", gridTemplateColumns: `repeat(${categories.length}, 1fr)`, gap: "8px" }}>
          {/* Category Headers */}
          {categories.map((cat) => {
            const isTeam1 = team1Cats.includes(cat.id);
            return (
              <div
                key={cat.id}
                className={`rounded-xl p-3 text-center border-2 ${isTeam1 ? "border-red-400/40 bg-red-900/20" : "border-blue-400/40 bg-blue-900/20"}`}
              >
                <div className="text-2xl mb-1">{CATEGORY_ICONS[cat.id] || "🎯"}</div>
                <div className="text-secondary text-xs font-black leading-tight">{cat.name}</div>
                <div className={`text-xs mt-1 font-bold ${isTeam1 ? "text-red-400" : "text-blue-400"}`}>
                  {isTeam1 ? "🔴 " + session?.team1_name : "🔵 " + session?.team2_name}
                </div>
              </div>
            );
          })}

          {/* Question Tiles */}
          {[200, 400, 600].map((difficulty) =>
            categories.map((cat) => {
              const key = `${cat.id}_${difficulty}`;
              const used = usedTiles.has(key);
              return (
                <button
                  key={key}
                  data-testid={`tile-${cat.id}-${difficulty}`}
                  onClick={() => handleTileClick(cat.id, difficulty)}
                  disabled={used}
                  className={`
                    question-tile ${used ? "used" : ""}
                    h-16 md:h-20 rounded-xl flex items-center justify-center font-black text-2xl md:text-3xl
                    bg-gradient-to-br ${used ? "from-primary/10 to-primary/5" : DIFFICULTY_COLORS[difficulty]}
                    border-2 ${used ? "border-secondary/10" : "border-secondary/30 hover:border-secondary hover:shadow-[0_0_15px_rgba(241,225,148,0.3)]"}
                    transition-all duration-300
                  `}
                >
                  {used ? (
                    <span className="text-secondary/15 text-lg">✗</span>
                  ) : (
                    <span className={`font-black ${difficulty === 200 ? "text-green-300" : difficulty === 400 ? "text-amber-300" : "text-red-300"}`}>
                      {difficulty}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Game over banner */}
      {allUsed && (
        <div className="fixed bottom-0 left-0 right-0 bg-secondary p-6 text-center">
          <div className="text-primary font-black text-2xl">
            {scores.team1 > scores.team2
              ? `🏆 ${session?.team1_name} فاز!`
              : scores.team2 > scores.team1
              ? `🏆 ${session?.team2_name} فاز!`
              : "🤝 تعادل!"}
          </div>
          <button onClick={() => { resetGame(); navigate("/"); }} className="mt-3 bg-primary text-secondary px-8 py-2 rounded-full font-bold">
            لعبة جديدة
          </button>
        </div>
      )}

      {/* End Game Confirm Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-primary border border-secondary/30 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-secondary text-2xl font-black mb-4">إنهاء اللعبة؟</div>
            <div className="text-secondary/70 mb-6">سيتم حساب النتيجة النهائية</div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { resetGame(); navigate("/"); }}
                className="bg-secondary text-primary px-6 py-3 rounded-full font-bold hover:scale-105 transition-all"
              >
                نعم، إنهاء
              </button>
              <button
                onClick={() => setShowEndConfirm(false)}
                className="bg-primary/50 border border-secondary/30 text-secondary px-6 py-3 rounded-full font-bold hover:scale-105 transition-all"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
