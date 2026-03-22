import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };
const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
const TEAM_ICONS  = ["🔴", "🔵", "🟢", "🟡"];

export default function MultiTeamSetupPage() {
  const navigate = useNavigate();
  const { initMultiTeams, createSession } = useGame();
  const [teamCount, setTeamCount] = useState(3);
  const [names, setNames] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    const activeNames = names.slice(0, teamCount);
    if (activeNames.some(n => !n.trim())) {
      toast.error("أدخل اسم كل الفرق!"); return;
    }
    const unique = new Set(activeNames.map(n => n.trim().toLowerCase()));
    if (unique.size < teamCount) {
      toast.error("يجب أن تكون أسماء الفرق مختلفة!"); return;
    }
    setLoading(true);
    try {
      const { data: cats } = await axios.get(`${API}/categories`);
      const freeCats = cats.filter(c => !c.is_premium);
      // Shuffle and assign unique categories
      const shuffled = [...freeCats].sort(() => Math.random() - 0.5);

      const teams = activeNames.map((name, i) => ({
        id: `team_${i + 1}`,
        name: name.trim(),
        color: TEAM_COLORS[i],
        icon: TEAM_ICONS[i],
        categoryId: shuffled[i]?.id || "cat_easy",
        categoryName: shuffled[i]?.name || "عام",
      }));

      initMultiTeams(teams);
      // Create session for question fetching (backend needs team1/team2)
      await createSession(teams[0].name, teams.length > 1 ? teams[1].name : "فريق ب");
      navigate("/multi-game");
    } catch {
      toast.error("حدث خطأ، حاول مرة ثانية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={DARK_BG}>
      <div className="w-full max-w-xl animate-scale-in">

        <button
          onClick={() => navigate("/mode")}
          className="text-secondary/50 hover:text-secondary mb-6 flex items-center gap-2 transition-colors font-bold"
        >
          ← رجوع
        </button>

        <div className="bg-primary/70 border border-secondary/30 rounded-3xl p-8 backdrop-blur-sm">
          <h1
            className="text-3xl font-black text-secondary text-center mb-1"
            style={{ fontFamily: "Cairo, sans-serif" }}
          >
            👥 مود متعدد الفرق
          </h1>
          <p className="text-secondary/55 text-center text-sm mb-6">
            اختر عدد الفرق وسمّهم
          </p>

          {/* Team count selector */}
          <div className="flex gap-3 mb-7">
            {[3, 4].map(n => (
              <button
                key={n}
                data-testid={`team-count-${n}`}
                onClick={() => setTeamCount(n)}
                className="flex-1 py-4 rounded-2xl font-black text-xl transition-all hover:scale-[1.03] active:scale-95"
                style={{
                  background: teamCount === n ? "linear-gradient(135deg,#5B0E14,#8B1520)" : "rgba(91,14,20,0.15)",
                  border: `2.5px solid ${teamCount === n ? "rgba(241,225,148,0.6)" : "rgba(241,225,148,0.15)"}`,
                  color: teamCount === n ? "#F1E194" : "rgba(241,225,148,0.4)",
                  boxShadow: teamCount === n ? "0 4px 20px rgba(91,14,20,0.5)" : "none",
                }}
              >
                {n} فرق
              </button>
            ))}
          </div>

          {/* Team name inputs */}
          <div className="space-y-4 mb-6">
            {Array.from({ length: teamCount }).map((_, i) => (
              <div key={i}>
                <label
                  className="block font-black mb-1.5"
                  style={{ color: TEAM_COLORS[i], fontSize: "0.95rem" }}
                >
                  {TEAM_ICONS[i]} الفريق {i + 1}
                </label>
                <input
                  data-testid={`multi-team-${i + 1}-input`}
                  type="text"
                  value={names[i]}
                  onChange={e => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setNames(next);
                  }}
                  placeholder={["الأحمر", "الأزرق", "الأخضر", "الذهبي"][i]}
                  maxLength={20}
                  className="w-full bg-primary-dark/50 text-secondary placeholder:text-secondary/25 px-4 py-3.5 rounded-xl text-lg font-bold text-right outline-none transition-all"
                  style={{
                    border: `2px solid ${names[i].trim() ? TEAM_COLORS[i] + "88" : "rgba(241,225,148,0.15)"}`,
                    background: names[i].trim() ? `${TEAM_COLORS[i]}10` : "rgba(91,14,20,0.2)",
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && i < teamCount - 1) {
                      document.querySelector(`[data-testid="multi-team-${i + 2}-input"]`)?.focus();
                    } else if (e.key === "Enter" && i === teamCount - 1) {
                      handleStart();
                    }
                  }}
                />
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div
            className="rounded-xl px-4 py-3 mb-6 text-center"
            style={{ background: "rgba(241,225,148,0.07)", border: "1px solid rgba(241,225,148,0.18)" }}
          >
            <span style={{ color: "rgba(241,225,148,0.5)", fontSize: "0.85rem" }}>
              💡 يُنصح بلاعبين أو أكثر لكل فريق للاستمتاع الكامل
            </span>
          </div>

          <button
            data-testid="multi-start-btn"
            onClick={handleStart}
            disabled={loading}
            className="w-full bg-secondary text-primary font-black text-xl py-4 rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(241,225,148,0.5)] transition-all duration-300 disabled:opacity-50"
          >
            {loading ? "جاري التحضير..." : `ابدأ مع ${teamCount} فرق →`}
          </button>
        </div>
      </div>
    </div>
  );
}
