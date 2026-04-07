import React from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

export default function HomePage() {
  const navigate = useNavigate();
  const { currentUser, logoutUser } = useGame();
  const isPremium = currentUser?.subscription_type === "premium";

  return (
    <div className="min-h-screen overflow-hidden" style={{...DARK_BG, minHeight:"100svh"}}>

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-secondary/6 blur-3xl rounded-full"/>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/4 blur-3xl rounded-full"/>
      </div>

      {/* ── Top Navigation Bar ── */}
      <div className="relative z-20 flex items-center justify-between px-5 py-3 border-b border-secondary/15 bg-primary/30 backdrop-blur-sm">
        {/* Left: User info */}
        {currentUser ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/30 text-secondary text-xs font-black">
              {(currentUser.username || "؟")[0].toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-secondary text-sm font-bold leading-none">{currentUser.username}</span>
              {isPremium ? (
                <span className="text-[10px] text-secondary/60 font-bold">✦ مميز</span>
              ) : (
                <button
                  data-testid="upgrade-btn"
                  onClick={() => navigate("/pricing")}
                  className="text-[10px] text-amber-400 font-bold hover:text-amber-300 transition-colors text-right"
                >
                  ترقية للمميز ↗
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              data-testid="login-nav-btn"
              onClick={() => navigate("/login")}
              className="bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 text-secondary text-sm font-black px-4 py-2 rounded-full transition-all"
            >
              دخول
            </button>
            <button
              data-testid="signup-nav-btn"
              onClick={() => navigate("/signup")}
              className="bg-secondary text-primary text-sm font-black px-4 py-2 rounded-full hover:scale-105 transition-all"
              style={{ boxShadow: "0 0 12px rgba(241,225,148,0.3)" }}
            >
              حساب جديد
            </button>
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {!isPremium && (
            <button
              data-testid="pricing-nav-btn"
              onClick={() => navigate("/pricing")}
              className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-black px-4 py-2 rounded-full transition-all"
            >
              ✦ اشترك
            </button>
          )}
          {currentUser && (
            <button
              data-testid="logout-btn"
              onClick={logoutUser}
              className="text-secondary/30 hover:text-secondary/60 text-xs font-bold transition-colors px-2 py-1"
            >
              خروج
            </button>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="relative z-10 flex flex-col items-center justify-start min-h-[calc(100vh-56px)] px-4 py-8 md:py-12">

        {/* ── Logo ── */}
        <div className="text-center mb-6 animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-1">
            <span style={{ fontSize: "clamp(3rem,8vw,6rem)" }}>🔮</span>
            <h1
              className="font-black text-secondary leading-none"
              style={{
                fontFamily: "Cairo, sans-serif",
                fontSize: "clamp(5rem, 18vw, 10rem)",
                textShadow: "0 0 60px rgba(241,225,148,0.5), 0 4px 20px rgba(0,0,0,0.5)",
              }}
            >
              حُجّة
            </h1>
          </div>
          <p className="text-secondary/50 text-sm md:text-base tracking-widest font-medium uppercase">
            HUJJAH • لعبة الأسئلة
          </p>
        </div>

        {/* ── Premium Notice ── */}
        {currentUser && !isPremium && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-3 max-w-md w-full text-center mb-5 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
            <p className="text-amber-300/90 text-sm">
              أسئلتك قد تتكرر —{" "}
              <button
                data-testid="pricing-inline-btn"
                onClick={() => navigate("/pricing")}
                className="text-amber-300 font-black underline hover:no-underline"
              >
                اشترك للحصول على أسئلة لا تتكرر
              </button>
            </p>
          </div>
        )}

        {/* ── CTA ── */}
        <button
          data-testid="start-game-btn"
          onClick={() => navigate("/mode")}
          className="animate-pulse-glow animate-fade-in-up mb-8 bg-secondary text-primary font-black rounded-full border-2 border-secondary/80 shadow-2xl hover:scale-105 transition-all duration-300"
          style={{
            animationDelay: "0.1s",
            fontSize: "clamp(1.2rem, 3vw, 1.6rem)",
            padding: "clamp(16px,3vw,22px) clamp(40px,7vw,70px)",
            boxShadow: "0 0 50px rgba(241,225,148,0.35), 0 8px 30px rgba(0,0,0,0.4)",
          }}
        >
          🎮 العب الحين
        </button>

        {/* ── Steps ── */}
        <div className="grid grid-cols-3 gap-3 max-w-2xl w-full mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          {[
            { n: "1", t: "سمّوا الفرق",    d: "كل فريق يختار اسمه" },
            { n: "2", t: "اختاروا الفئات", d: "3 فئات لكل فريق"    },
            { n: "3", t: "العب وانتصر",    d: "أجب وجمّع النقاط"    },
          ].map(s => (
            <div key={s.n} className="bg-primary/50 border border-secondary/20 rounded-2xl p-4 text-center hover:border-secondary/40 transition-colors">
              <div className="text-secondary text-3xl font-black mb-1">{s.n}</div>
              <div className="text-secondary font-bold text-sm">{s.t}</div>
              <div className="text-secondary/50 text-xs mt-0.5">{s.d}</div>
            </div>
          ))}
        </div>

        {/* ── Feature highlights ── */}
        <div className="grid grid-cols-2 gap-3 max-w-sm w-full mb-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
          {[
            { icon: "🏆", text: "وضع البطولة" },
            { icon: "🎯", text: "أسئلة بالصور" },
            { icon: "⚡", text: "مؤقت للإجابة" },
            { icon: "🔄", text: "أسئلة لا تتكرر" },
          ].map(f => (
            <div key={f.text} className="bg-primary/30 border border-secondary/10 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-base">{f.icon}</span>
              <span className="text-secondary/70 text-xs font-bold">{f.text}</span>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-4 mt-4">
          <button
            data-testid="admin-link"
            onClick={() => navigate("/admin")}
            className="text-secondary/20 text-xs hover:text-secondary/50 transition-colors font-bold"
          >
            الإدارة
          </button>
          <span className="text-secondary/10">·</span>
          <button
            onClick={() => navigate("/pricing")}
            className="text-secondary/20 text-xs hover:text-secondary/50 transition-colors font-bold"
          >
            الأسعار
          </button>
          <span className="text-secondary/10">·</span>
          <button
            onClick={() => navigate("/signup")}
            className="text-secondary/20 text-xs hover:text-secondary/50 transition-colors font-bold"
          >
            حساب جديد
          </button>
        </div>
      </div>
    </div>
  );
}
