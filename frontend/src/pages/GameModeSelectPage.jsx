import React from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

const MODES = [
  {
    id: "standard",
    icon: "⚔",
    title: "اللعبة العادية",
    subtitle: "فريق ضد فريق",
    desc: "لوحة أسئلة كلاسيكية — الأنسب لأغلب المناسبات",
    badge: "الأكثر شيوعاً",
    badgeColor: "#16a34a",
    accentColor: "#5B0E14",
    glowColor: "rgba(91,14,20,0.55)",
    path: "/setup",
  },
  {
    id: "tournament",
    icon: "🏆",
    title: "مود البطولة",
    subtitle: "حتى 8 فرق",
    desc: "ربع نهائي ← نصف نهائي ← النهائي — بطل واحد فقط",
    badge: null,
    accentColor: "#78350f",
    glowColor: "rgba(120,53,15,0.45)",
    path: "/tournament",
  },
];

export default function GameModeSelectPage() {
  const navigate = useNavigate();
  const { setGameMode } = useGame();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={DARK_BG}>
      <div className="w-full max-w-lg">

        <button
          data-testid="mode-back-btn"
          onClick={() => navigate("/")}
          className="text-secondary/50 hover:text-secondary mb-8 flex items-center gap-2 transition-colors font-bold"
        >
          ← رجوع
        </button>

        <div className="text-center mb-8">
          <h1
            className="text-4xl md:text-5xl font-black text-secondary mb-2"
            style={{ fontFamily: "Cairo, sans-serif" }}
          >
            اختر نوع اللعبة
          </h1>
          <p className="text-secondary/40 text-base">وضعان للعب في كل مناسبة</p>
        </div>

        <div className="space-y-5">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              data-testid={`mode-${mode.id}-btn`}
              onClick={() => {
                setGameMode(mode.id);
                navigate(mode.path);
              }}
              className="w-full text-right rounded-3xl p-6 border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
              style={{
                background: `${mode.accentColor}15`,
                borderColor: `${mode.accentColor}44`,
                boxShadow: `0 4px 28px ${mode.glowColor}`,
              }}
            >
              {/* hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"
                style={{ background: `radial-gradient(ellipse at center, ${mode.accentColor}12, transparent 70%)` }}
              />
              <div className="relative flex items-center gap-5">
                <div
                  className="text-5xl w-20 h-20 flex items-center justify-center rounded-2xl shrink-0"
                  style={{ background: `${mode.accentColor}25`, border: `1.5px solid ${mode.accentColor}44` }}
                >
                  {mode.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="text-2xl font-black text-secondary"
                      style={{ fontFamily: "Cairo, sans-serif" }}
                    >
                      {mode.title}
                    </span>
                    {mode.badge && (
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-black text-white"
                        style={{ background: mode.badgeColor }}
                      >
                        ⭐ {mode.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-secondary/55 text-sm font-bold mb-0.5">{mode.subtitle}</div>
                  <div className="text-secondary/35 text-sm">{mode.desc}</div>
                </div>
                <div className="text-secondary/25 text-3xl shrink-0 group-hover:text-secondary/55 transition-colors" style={{ transform: "scaleX(-1)" }}>←</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
