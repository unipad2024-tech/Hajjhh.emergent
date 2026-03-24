import React from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";

export default function GameModeSelectPage() {
  const navigate = useNavigate();
  const { setGameMode } = useGame();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "radial-gradient(ellipse at 30% 20%, #4a0a10 0%, #2a0508 30%, #150203 65%, #0a0102 100%)",
        fontFamily: "Cairo, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <button
          data-testid="mode-back-btn"
          onClick={() => navigate("/")}
          className="text-secondary/40 hover:text-secondary/70 transition-colors font-bold text-sm flex items-center gap-2"
        >
          ← رجوع
        </button>
        <div className="text-secondary/20 text-xs font-bold tracking-widest uppercase">HUJJAH · حُجّة</div>
        <div className="w-16" />
      </div>

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-12">
          <div
            className="text-6xl md:text-7xl font-black text-secondary mb-3"
            style={{ letterSpacing: "-2px", textShadow: "0 0 60px rgba(241,225,148,0.3)" }}
          >
            اختر نوع اللعبة
          </div>
          <div className="text-secondary/40 text-lg font-bold">
            وضعان للعب في كل مناسبة
          </div>
        </div>

        {/* ── Mode cards ── */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Standard Mode */}
          <button
            data-testid="mode-standard-btn"
            onClick={() => { setGameMode("standard"); navigate("/setup"); }}
            className="group relative rounded-3xl overflow-hidden text-right transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 active:scale-[0.97]"
            style={{
              background: "linear-gradient(145deg, rgba(91,14,20,0.6) 0%, rgba(40,5,8,0.8) 100%)",
              border: "2px solid rgba(241,225,148,0.2)",
              boxShadow: "0 8px 40px rgba(91,14,20,0.5), inset 0 1px 0 rgba(241,225,148,0.1)",
              padding: "clamp(28px, 4vh, 48px) clamp(24px, 3vw, 40px)",
            }}
          >
            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
              style={{ background: "radial-gradient(ellipse at center, rgba(241,225,148,0.07) 0%, transparent 70%)" }}
            />

            {/* Most popular badge */}
            <div className="absolute top-5 left-5">
              <span
                className="px-3 py-1.5 rounded-full font-black text-xs text-white"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                ⭐ الأكثر شيوعاً
              </span>
            </div>

            <div className="relative">
              <div
                className="text-7xl mb-5 transition-transform duration-300 group-hover:scale-110 inline-block"
                style={{ filter: "drop-shadow(0 4px 20px rgba(241,225,148,0.3))" }}
              >
                ⚔
              </div>
              <div className="text-3xl font-black text-secondary mb-2">اللعبة العادية</div>
              <div className="text-secondary/55 text-base font-bold mb-3">فريق ضد فريق</div>
              <div className="text-secondary/35 text-sm leading-relaxed">
                لوحة أسئلة كلاسيكية — 6 فئات × 3 مستويات صعوبة
              </div>

              <div
                className="mt-6 flex items-center gap-2 text-secondary/50 group-hover:text-secondary/80 transition-colors"
              >
                <span className="font-black text-sm">ابدأ اللعبة</span>
                <span style={{ transform: "scaleX(-1)" }}>←</span>
              </div>
            </div>
          </button>

          {/* Tournament Mode */}
          <button
            data-testid="mode-tournament-btn"
            onClick={() => { setGameMode("tournament"); navigate("/tournament"); }}
            className="group relative rounded-3xl overflow-hidden text-right transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 active:scale-[0.97]"
            style={{
              background: "linear-gradient(145deg, rgba(120,53,15,0.55) 0%, rgba(40,15,5,0.8) 100%)",
              border: "2px solid rgba(241,225,148,0.15)",
              boxShadow: "0 8px 40px rgba(120,53,15,0.4), inset 0 1px 0 rgba(241,225,148,0.08)",
              padding: "clamp(28px, 4vh, 48px) clamp(24px, 3vw, 40px)",
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
              style={{ background: "radial-gradient(ellipse at center, rgba(241,225,148,0.05) 0%, transparent 70%)" }}
            />

            <div className="relative">
              <div
                className="text-7xl mb-5 transition-transform duration-300 group-hover:scale-110 inline-block"
                style={{ filter: "drop-shadow(0 4px 20px rgba(241,225,148,0.25))" }}
              >
                🏆
              </div>
              <div className="text-3xl font-black text-secondary mb-2">مود البطولة</div>
              <div className="text-secondary/55 text-base font-bold mb-3">حتى 8 فرق</div>
              <div className="text-secondary/35 text-sm leading-relaxed">
                ربع نهائي ← نصف نهائي ← النهائي — بطل واحد فقط
              </div>

              <div className="mt-6 flex items-center gap-2 text-secondary/50 group-hover:text-secondary/80 transition-colors">
                <span className="font-black text-sm">أنشئ البطولة</span>
                <span style={{ transform: "scaleX(-1)" }}>←</span>
              </div>
            </div>
          </button>
        </div>

        {/* Sub-text */}
        <p className="text-secondary/20 text-sm mt-10 text-center">
          مناسب للجلسات العائلية · حفلات الأصدقاء · الأمسيات الترفيهية
        </p>
      </div>
    </div>
  );
}
