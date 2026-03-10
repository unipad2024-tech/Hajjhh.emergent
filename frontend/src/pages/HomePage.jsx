import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CAT_META = {
  cat_flags:   { icon:"🏳️", color:"#166534" },
  cat_easy:    { icon:"💡", color:"#1e40af" },
  cat_saudi:   { icon:"🇸🇦", color:"#5B0E14" },
  cat_islamic: { icon:"☪️", color:"#065f46" },
  cat_science: { icon:"🔬", color:"#4c1d95" },
  cat_logos:   { icon:"🏷️", color:"#7c2d12" },
  cat_word:    { icon:"🤫", color:"#4a044e" },
};

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

export default function HomePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios.get(`${API}/categories`).then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen overflow-hidden" style={{...DARK_BG, minHeight:"100svh"}}>

      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-secondary/5 blur-3xl rounded-full"/>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/4 blur-3xl rounded-full"/>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 py-8 md:py-12">

        {/* ── Logo ── */}
        <div className="text-center mb-6 animate-fade-in-up">
          <h1
            className="font-black text-secondary leading-none"
            style={{
              fontFamily:"Cairo,sans-serif",
              fontSize:"clamp(5rem, 18vw, 10rem)",
              textShadow:"0 0 50px rgba(241,225,148,0.45), 0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            حُجّة
          </h1>
          <p className="text-secondary/60 font-medium mt-1 text-base md:text-lg tracking-wide">
            لعبة فريق تريفيا الاجتماعية
          </p>
        </div>

        {/* ── Tagline ── */}
        <div
          className="bg-primary/50 border border-secondary/25 backdrop-blur-sm rounded-2xl px-6 py-4 max-w-md w-full text-center mb-8 animate-fade-in-up"
          style={{animationDelay:"0.1s"}}
        >
          <p className="text-secondary font-bold text-lg md:text-xl">حيّاك في لعبة حُجّة!</p>
          <p className="text-secondary/70 text-sm md:text-base mt-1">
            اختبر معلوماتك وتحدّى ربعك في لعبة مليانة حماس وضحك
          </p>
        </div>

        {/* ── CTA ── */}
        <button
          data-testid="start-game-btn"
          onClick={() => navigate("/setup")}
          className="animate-pulse-glow animate-fade-in-up mb-10 bg-secondary text-primary font-black rounded-full border-2 border-secondary/80 shadow-2xl hover:scale-105 transition-all duration-300"
          style={{
            animationDelay:"0.2s",
            fontSize:"clamp(1.1rem, 3vw, 1.5rem)",
            padding:"clamp(14px,3vw,20px) clamp(32px,6vw,56px)",
            boxShadow:"0 0 40px rgba(241,225,148,0.3), 0 8px 30px rgba(0,0,0,0.4)",
          }}
        >
          🎮 العب الحين
        </button>

        {/* ── Steps ── */}
        <div
          className="grid grid-cols-3 gap-3 max-w-2xl w-full mb-10 animate-fade-in-up"
          style={{animationDelay:"0.3s"}}
        >
          {[
            { n:"١", t:"سمّوا الفرق",    d:"كل فريق يختار اسمه" },
            { n:"٢", t:"اختاروا الفئات", d:"٣ فئات لكل فريق"    },
            { n:"٣", t:"العب وانتصر",    d:"أجب وجمّع النقاط"    },
          ].map(s => (
            <div key={s.n} className="bg-primary/40 border border-secondary/15 rounded-xl p-3 text-center">
              <div className="text-secondary text-2xl font-black mb-1">{s.n}</div>
              <div className="text-secondary font-bold text-sm">{s.t}</div>
              <div className="text-secondary/50 text-xs mt-0.5">{s.d}</div>
            </div>
          ))}
        </div>

        {/* ── Categories ── */}
        {categories.length > 0 && (
          <div className="w-full max-w-3xl animate-fade-in-up" style={{animationDelay:"0.4s"}}>
            <h2 className="text-secondary/70 text-center text-sm font-bold uppercase tracking-widest mb-3">الفئات</h2>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2 md:gap-3">
              {categories.map((cat, i) => {
                const m = CAT_META[cat.id] || { icon:"🎯", color:"#5B0E14" };
                return (
                  <div
                    key={cat.id}
                    className="rounded-xl p-2 md:p-3 text-center border border-secondary/15 hover:border-secondary/50 hover:scale-105 transition-all duration-300 cursor-default"
                    style={{
                      background:`linear-gradient(145deg, ${m.color}cc, ${m.color}33)`,
                      animationDelay:`${0.05*i}s`,
                    }}
                  >
                    <div className="text-2xl md:text-3xl mb-1">{m.icon}</div>
                    <div className="text-secondary text-[10px] md:text-xs font-bold leading-tight">{cat.name}</div>
                    {cat.is_special && (
                      <div className="mt-1 text-secondary/70 text-[9px] bg-secondary/10 rounded px-1">QR</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Admin ── */}
        <button
          data-testid="admin-link"
          onClick={() => navigate("/admin")}
          className="mt-10 text-secondary/20 text-xs hover:text-secondary/50 transition-colors"
        >
          لوحة الإدارة
        </button>
      </div>
    </div>
  );
}
