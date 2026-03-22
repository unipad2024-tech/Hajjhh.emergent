import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { toast } from "sonner";

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };
const COLORS = ["#ef4444","#3b82f6","#22c55e","#f59e0b","#a855f7","#ec4899","#14b8a6","#f97316"];

function generateBracket(teams) {
  const size = Math.pow(2, Math.ceil(Math.log2(teams.length)));
  const padded = [...teams, ...Array(size - teams.length).fill(null)];
  const rounds = [];
  let current = [...padded];
  const roundNames = { 2: "النهائي", 4: "نصف النهائي", 8: "ربع النهائي", 16: "دور الـ 16" };

  while (current.length > 1) {
    const matches = [];
    const nextRound = [];
    for (let i = 0; i < current.length; i += 2) {
      const t1 = current[i];
      const t2 = current[i + 1];
      if (t1 && !t2) {
        matches.push({ id: `r${rounds.length}_m${i/2}`, team1: t1, team2: null, winner: t1.id, isBye: true });
        nextRound.push(t1);
      } else if (!t1 && t2) {
        matches.push({ id: `r${rounds.length}_m${i/2}`, team1: null, team2: t2, winner: t2.id, isBye: true });
        nextRound.push(t2);
      } else {
        matches.push({ id: `r${rounds.length}_m${i/2}`, team1: t1, team2: t2, winner: null, isBye: false });
        nextRound.push(null);
      }
    }
    rounds.push({ name: roundNames[current.length] || `جولة ${rounds.length + 1}`, matches });
    current = nextRound;
  }
  return rounds;
}

export default function TournamentSetupPage() {
  const navigate = useNavigate();
  const { setTournament } = useGame();
  const [teamCount, setTeamCount] = useState(4);
  const [names, setNames] = useState(Array(8).fill(""));

  const handleStart = () => {
    const activeNames = names.slice(0, teamCount);
    if (activeNames.some(n => !n.trim())) {
      toast.error("أدخل أسماء جميع الفرق!"); return;
    }
    const unique = new Set(activeNames.map(n => n.trim().toLowerCase()));
    if (unique.size < teamCount) {
      toast.error("أسماء الفرق يجب أن تكون مختلفة!"); return;
    }
    const teams = activeNames.map((name, i) => ({
      id: `t${i}`,
      name: name.trim(),
      color: COLORS[i],
    }));
    const rounds = generateBracket(teams);
    setTournament({ teams, rounds, champion: null });
    navigate("/tournament/bracket");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8" style={DARK_BG}>
      <div className="w-full max-w-2xl animate-scale-in">
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
            🏆 مود البطولة
          </h1>
          <p className="text-secondary/55 text-center text-sm mb-6">
            اختر عدد الفرق وسجّلهم — ثم انطلق نحو البطولة
          </p>

          {/* Team count selector */}
          <div className="flex gap-3 mb-7">
            {[4, 6, 8].map(n => (
              <button
                key={n}
                data-testid={`tournament-count-${n}`}
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

          {/* Team name grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Array.from({ length: teamCount }).map((_, i) => (
              <div key={i}>
                <label
                  className="block font-black text-xs mb-1.5"
                  style={{ color: COLORS[i] }}
                >
                  الفريق {i + 1}
                </label>
                <input
                  data-testid={`tournament-team-${i + 1}`}
                  type="text"
                  value={names[i]}
                  onChange={e => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setNames(next);
                  }}
                  placeholder={`فريق ${i + 1}`}
                  maxLength={15}
                  className="w-full bg-primary-dark/50 text-secondary placeholder:text-secondary/25 px-3 py-3 rounded-xl font-bold text-right text-base outline-none transition-all"
                  style={{
                    border: `2px solid ${names[i].trim() ? COLORS[i] + "80" : "rgba(241,225,148,0.12)"}`,
                    background: names[i].trim() ? `${COLORS[i]}10` : "rgba(91,14,20,0.2)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Bracket preview info */}
          <div
            className="rounded-xl px-4 py-3 mb-6 text-center"
            style={{ background: "rgba(241,225,148,0.06)", border: "1px solid rgba(241,225,148,0.15)" }}
          >
            <span style={{ color: "rgba(241,225,148,0.5)", fontSize: "0.8rem" }}>
              📋 سيتم إنشاء{" "}
              {teamCount <= 4 ? "نصف نهائي + نهائي" : teamCount <= 6 ? "ربع نهائي + نصف نهائي + نهائي" : "ربع نهائي + نصف نهائي + نهائي"}
              {" "}— الفرق الزائدة تحصل على تعبئة تلقائية
            </span>
          </div>

          <button
            data-testid="tournament-start-btn"
            onClick={handleStart}
            className="w-full bg-secondary text-primary font-black text-xl py-4 rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(241,225,148,0.5)] transition-all duration-300"
          >
            إنشاء البطولة 🏆
          </button>
        </div>
      </div>
    </div>
  );
}
