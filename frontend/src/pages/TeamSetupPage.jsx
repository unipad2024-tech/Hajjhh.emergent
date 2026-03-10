import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { toast } from "sonner";

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

export default function TeamSetupPage() {
  const navigate = useNavigate();
  const { createSession, loading } = useGame();
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");

  const handleStart = async () => {
    if (!team1.trim() || !team2.trim()) {
      toast.error("أدخل اسم الفريقين!");
      return;
    }
    if (team1.trim() === team2.trim()) {
      toast.error("اسم الفريقين لازم يكون مختلف!");
      return;
    }
    try {
      await createSession(team1.trim(), team2.trim());
      navigate("/categories");
    } catch (e) {
      toast.error("حدث خطأ، حاول مرة ثانية");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={DARK_BG}>
      <div className="w-full max-w-lg animate-scale-in">
        {/* Back */}
        <button
          data-testid="back-btn"
          onClick={() => navigate("/")}
          className="text-secondary/60 hover:text-secondary mb-6 flex items-center gap-2 transition-colors"
        >
          ← رجوع
        </button>

        <div className="bg-primary/70 border border-secondary/30 rounded-3xl p-8 backdrop-blur-sm">
          <h1 className="text-4xl font-black text-secondary text-center mb-2">سمّوا فرقكم</h1>
          <p className="text-secondary/60 text-center mb-8">اختاروا اسم حماسي لكل فريق!</p>

          <div className="space-y-6">
            {/* Team 1 */}
            <div>
              <label data-testid="team1-label" className="block text-secondary font-bold text-lg mb-2">
                🔴 الفريق الأول
              </label>
              <input
                data-testid="team1-input"
                type="text"
                value={team1}
                onChange={(e) => setTeam1(e.target.value)}
                placeholder="مثال: الأسود"
                maxLength={20}
                className="w-full bg-primary-dark/50 border-2 border-secondary/30 focus:border-secondary text-secondary placeholder:text-secondary/30 px-4 py-4 rounded-xl text-xl font-bold outline-none transition-all text-right"
                onKeyDown={(e) => e.key === "Enter" && document.getElementById("team2-input")?.focus()}
              />
            </div>

            {/* VS Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-secondary/20" />
              <div className="text-secondary/50 font-black text-2xl">VS</div>
              <div className="flex-1 h-px bg-secondary/20" />
            </div>

            {/* Team 2 */}
            <div>
              <label data-testid="team2-label" className="block text-secondary font-bold text-lg mb-2">
                🔵 الفريق الثاني
              </label>
              <input
                id="team2-input"
                data-testid="team2-input"
                type="text"
                value={team2}
                onChange={(e) => setTeam2(e.target.value)}
                placeholder="مثال: النسور"
                maxLength={20}
                className="w-full bg-primary-dark/50 border-2 border-secondary/30 focus:border-secondary text-secondary placeholder:text-secondary/30 px-4 py-4 rounded-xl text-xl font-bold outline-none transition-all text-right"
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
              />
            </div>
          </div>

          <button
            data-testid="start-game-btn"
            onClick={handleStart}
            disabled={loading}
            className="mt-8 w-full bg-secondary text-primary font-black text-xl py-4 rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(241,225,148,0.5)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "جاري التحضير..." : "التالي →"}
          </button>
        </div>
      </div>
    </div>
  );
}
