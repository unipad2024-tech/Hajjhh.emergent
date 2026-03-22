import React from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

const MODES = [
  {
    id: "standard",
    icon: "⚔",
    title: "المود العادي",
    subtitle: "فريقان يتنافسان",
    desc: "لوحة أسئلة كلاسيكية — الأنسب لأغلب المناسبات",
    badge: "الأكثر شيوعاً",
    accentColor: "#5B0E14",
    glowColor: "rgba(91,14,20,0.5)",
    path: "/setup",
  },
  {
    id: "multi",
    icon: "👥",
    title: "مود متعدد الفرق",
    subtitle: "3 أو 4 فرق",
    desc: "كل فريق له عموده الخاص — 300 · 600 · 900",
    badge: null,
    accentColor: "#1e40af",
    glowColor: "rgba(30,64,175,0.4)",
    path: "/multi-setup",
  },
  {
    id: "tournament",
    icon: "🏆",
    title: "مود البطولة",
    subtitle: "حتى 8 فرق",
    desc: "ربع نهائي ← نصف نهائي ← النهائي — بطل واحد فقط",
    badge: null,
    accentColor: "#78350f",
    glowColor: "rgba(120,53,15,0.4)",
    path: "/tournament",
  },
];

export default function GameModeSelectPage() {
  const navigate = useNavigate();
  const { setGameMode } = useGame();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={DARK_BG}>
      <div className="w-full max-w-xl">

        {/* Back */}
        <button
          data-testid="mode-back-btn"
          onClick={() => navigate("/")}
          className="text-secondary/50 hover:text-secondary mb-8 flex items-center gap-2 transition-colors font-bold"
        >
          ← رجوع
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl md:text-5xl font-black text-secondary mb-2"
            style={{ fontFamily: "Cairo, sans-serif" }}
          >
            اختر نوع اللعبة
          </h1>
          <p className="text-secondary/45 text-base">ثلاثة أوضاع لكل مناسبة</p>
        </div>

        {/* Mode Cards */}
        <div className="space-y-4">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              data-testid={`mode-${mode.id}-btn`}
              onClick={() => {
                setGameMode(mode.id);
                navigate(mode.path);
              }}
              className="w-full text-right rounded-3xl p-5 md:p-6 border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
              style={{
                background: `${mode.accentColor}18`,
                borderColor: `${mode.accentColor}44`,
                boxShadow: `0 4px 24px ${mode.glowColor}`,
              }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"
                style={{ background: `radial-gradient(ellipse at center, ${mode.accentColor}15, transparent 70%)` }}
              />

              <div className="relative flex items-center gap-4">
                {/* Icon */}
                <div
                  className="text-4xl w-16 h-16 flex items-center justify-center rounded-2xl shrink-0"
                  style={{ background: `${mode.accentColor}28`, border: `1.5px solid ${mode.accentColor}44` }}
                >
                  {mode.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span
                      className="text-xl md:text-2xl font-black text-secondary"
                      style={{ fontFamily: "Cairo, sans-serif" }}
                    >
                      {mode.title}
                    </span>
                    {mode.badge && (
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-black text-white"
                        style={{ background: "#16a34a" }}
                      >
                        ⭐ {mode.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-secondary/55 text-sm font-bold mb-0.5">{mode.subtitle}</div>
                  <div className="text-secondary/35 text-xs md:text-sm">{mode.desc}</div>
                </div>

                {/* Arrow */}
                <div
                  className="text-secondary/25 text-2xl shrink-0 group-hover:text-secondary/55 transition-colors"
                  style={{ transform: "scaleX(-1)" }}
                >
                  ←
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
