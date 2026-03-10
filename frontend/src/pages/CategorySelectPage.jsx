import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_ICONS = {
  cat_flags: "🏳️", cat_easy: "💡", cat_saudi: "🇸🇦",
  cat_islamic: "☪️", cat_science: "🔬", cat_logos: "🏷️", cat_word: "🤫",
};

export default function CategorySelectPage() {
  const navigate = useNavigate();
  const { session, updateSession } = useGame();
  const [categories, setCategories] = useState([]);
  const [team1Picks, setTeam1Picks] = useState([]);
  const [team2Picks, setTeam2Picks] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    axios.get(`${API}/categories`).then(({ data }) => {
      setCategories(data);
      setLoading(false);
    });
  }, [session, navigate]);

  const handlePick = (catId) => {
    if (currentTeam === 1) {
      if (team1Picks.includes(catId)) {
        setTeam1Picks(team1Picks.filter((c) => c !== catId));
      } else if (team1Picks.length < 3) {
        const newPicks = [...team1Picks, catId];
        setTeam1Picks(newPicks);
        if (newPicks.length === 3) {
          toast.success(`${session.team1_name} اختار ${newPicks.length} فئات`);
        }
      }
    } else {
      if (team2Picks.includes(catId)) {
        setTeam2Picks(team2Picks.filter((c) => c !== catId));
      } else if (team2Picks.length < 3) {
        const newPicks = [...team2Picks, catId];
        setTeam2Picks(newPicks);
        if (newPicks.length === 3) {
          toast.success(`${session.team2_name} اختار ${newPicks.length} فئات`);
        }
      }
    }
  };

  const handleNext = async () => {
    if (currentTeam === 1) {
      if (team1Picks.length < 3) { toast.error("اختر 3 فئات للفريق الأول!"); return; }
      setCurrentTeam(2);
    } else {
      if (team2Picks.length < 3) { toast.error("اختر 3 فئات للفريق الثاني!"); return; }
      await updateSession({
        team1_categories: team1Picks,
        team2_categories: team2Picks,
        status: "playing",
      });
      navigate("/game");
    }
  };

  if (loading) return (
    <div className="min-h-screen game-board-bg flex items-center justify-center">
      <div className="text-secondary text-2xl">جاري التحميل...</div>
    </div>
  );

  const picks = currentTeam === 1 ? team1Picks : team2Picks;
  const teamName = currentTeam === 1 ? session?.team1_name : session?.team2_name;
  const teamColor = currentTeam === 1 ? "🔴" : "🔵";

  return (
    <div className="min-h-screen game-board-bg pattern-overlay px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="text-secondary/60 text-sm mb-2">الخطوة {currentTeam} من 2</div>
          <h1 className="text-4xl font-black text-secondary">
            {teamColor} {teamName}
          </h1>
          <p className="text-secondary/70 text-lg mt-2">
            اختر <span className="text-secondary font-black text-xl">{3 - picks.length}</span> فئة
            {picks.length > 0 && ` (اخترت ${picks.length})`}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2].map((t) => (
            <div key={t} className={`h-3 rounded-full transition-all duration-300 ${t === currentTeam ? "w-8 bg-secondary" : t < currentTeam ? "w-3 bg-secondary/60" : "w-3 bg-secondary/20"}`} />
          ))}
        </div>

        {/* Team 1 done banner */}
        {currentTeam === 2 && team1Picks.length > 0 && (
          <div className="bg-green-900/40 border border-green-500/30 rounded-xl p-3 mb-4 text-center">
            <span className="text-green-400 text-sm font-bold">
              ✓ {session?.team1_name} اختار: {team1Picks.map(id => categories.find(c => c.id === id)?.name).join(" • ")}
            </span>
          </div>
        )}

        {/* Category Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {categories.map((cat, i) => {
            const isSelected = picks.includes(cat.id);
            const isOtherTeam = currentTeam === 2 && team1Picks.includes(cat.id);

            return (
              <button
                key={cat.id}
                data-testid={`category-${cat.id}`}
                onClick={() => !isOtherTeam && handlePick(cat.id)}
                disabled={isOtherTeam && !picks.includes(cat.id)}
                className={`
                  relative rounded-2xl p-4 text-center border-2 transition-all duration-300 flex flex-col items-center gap-2
                  ${isSelected
                    ? "bg-secondary text-primary border-secondary shadow-[0_0_20px_rgba(241,225,148,0.5)] scale-105"
                    : isOtherTeam
                    ? "bg-primary/20 border-primary/20 opacity-40 cursor-not-allowed"
                    : "bg-primary/50 border-secondary/20 hover:border-secondary hover:scale-105 cursor-pointer text-secondary"}
                `}
                style={{ animationDelay: `${0.05 * i}s` }}
              >
                {isSelected && (
                  <div className="absolute top-2 left-2 bg-primary text-secondary rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
                    ✓
                  </div>
                )}
                <span className="text-4xl">{CATEGORY_ICONS[cat.id] || "🎯"}</span>
                <span className={`font-bold text-sm leading-tight ${isSelected ? "text-primary" : "text-secondary"}`}>
                  {cat.name}
                </span>
                {cat.is_special && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary/80"}`}>
                    خاص
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <div className="flex justify-center">
          <button
            data-testid="next-btn"
            onClick={handleNext}
            disabled={picks.length < 3}
            className={`px-12 py-4 rounded-full font-black text-xl transition-all duration-300
              ${picks.length === 3
                ? "bg-secondary text-primary hover:scale-105 hover:shadow-[0_0_30px_rgba(241,225,148,0.5)]"
                : "bg-secondary/20 text-secondary/40 cursor-not-allowed"}`}
          >
            {currentTeam === 1 ? "التالي →" : "ابدأ اللعبة! 🎮"}
          </button>
        </div>
      </div>
    </div>
  );
}
