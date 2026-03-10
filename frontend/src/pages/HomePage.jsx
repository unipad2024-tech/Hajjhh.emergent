import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_ICONS = {
  cat_flags: "🏳️",
  cat_easy: "💡",
  cat_saudi: "🇸🇦",
  cat_islamic: "☪️",
  cat_science: "🔬",
  cat_logos: "🏷️",
  cat_word: "🤫",
};

const CATEGORY_COLORS = {
  cat_flags: "from-green-900 to-green-700",
  cat_easy: "from-blue-900 to-blue-700",
  cat_saudi: "from-primary-dark to-primary",
  cat_islamic: "from-emerald-900 to-emerald-700",
  cat_science: "from-indigo-900 to-indigo-700",
  cat_logos: "from-orange-900 to-orange-700",
  cat_word: "from-purple-900 to-purple-700",
};

export default function HomePage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
      const { data } = await axios.get(`${API}/categories`);
      if (data.length === 0) {
        const token = localStorage.getItem("admin_token");
        if (token) {
          await axios.post(`${API}/seed`, {}, { headers: { Authorization: `Bearer ${token}` } });
        }
        const { data: seededCats } = await axios.get(`${API}/categories`);
        setCategories(seededCats);
      } else {
        setCategories(data);
      }
      setSeeded(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen game-board-bg pattern-overlay relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 py-8">
        {/* Logo & Title */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="text-8xl md:text-9xl font-black text-secondary leading-none mb-2" style={{ fontFamily: "'Cairo', sans-serif", textShadow: "0 0 40px rgba(241,225,148,0.5)" }}>
            حُجّة
          </div>
          <div className="text-secondary/70 text-lg md:text-xl font-medium mt-2">
            لعبة فريق تريفيا الاجتماعية
          </div>
        </div>

        {/* Welcome message */}
        <div className="bg-primary/60 border border-secondary/30 rounded-2xl p-6 max-w-xl w-full mb-8 text-center animate-fade-in-up backdrop-blur-sm" style={{ animationDelay: "0.1s" }}>
          <p className="text-secondary text-xl font-bold leading-relaxed">
            حيّاك في لعبة حُجّة!
          </p>
          <p className="text-secondary/80 text-base mt-2 leading-relaxed">
            اختبر معلوماتك وتحدّى ربعك في لعبة مليانة حماس وضحك!
          </p>
        </div>

        {/* Start Button */}
        <button
          data-testid="start-game-btn"
          onClick={() => navigate("/setup")}
          className="btn-primary text-xl md:text-2xl px-12 py-5 mb-10 animate-pulse-glow animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          🎮 لعبة جماعية
        </button>

        {/* How to Play */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mb-10 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          {[
            { num: "١", title: "سمّوا الفرق", desc: "كل فريق يختار اسمه" },
            { num: "٢", title: "اختاروا الفئات", desc: "كل فريق يختار 3 فئات" },
            { num: "٣", title: "العب وانتصر", desc: "أجب وجمّع النقاط" },
          ].map((step) => (
            <div key={step.num} className="bg-primary/40 border border-secondary/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-secondary mb-2">{step.num}</div>
              <div className="text-secondary font-bold text-lg">{step.title}</div>
              <div className="text-secondary/60 text-sm mt-1">{step.desc}</div>
            </div>
          ))}
        </div>

        {/* Categories Preview */}
        {categories.length > 0 && (
          <div className="w-full max-w-4xl animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <h2 className="text-secondary text-center text-2xl font-bold mb-4">الفئات المتاحة</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {categories.map((cat, i) => (
                <div
                  key={cat.id}
                  className={`bg-gradient-to-br ${CATEGORY_COLORS[cat.id] || "from-primary-dark to-primary"} rounded-xl p-3 text-center border border-secondary/20 hover:border-secondary/60 hover:scale-105 transition-all duration-300`}
                  style={{ animationDelay: `${0.1 * i}s` }}
                >
                  <div className="text-3xl mb-1">{CATEGORY_ICONS[cat.id] || "🎯"}</div>
                  <div className="text-secondary text-xs font-bold leading-tight">{cat.name}</div>
                  {cat.is_special && (
                    <div className="mt-1 bg-secondary/20 rounded text-secondary/80 text-xs px-1">خاص</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin link */}
        <div className="mt-8 text-secondary/30 text-sm">
          <button
            data-testid="admin-link"
            onClick={() => navigate("/admin")}
            className="hover:text-secondary/60 transition-colors"
          >
            لوحة الإدارة
          </button>
        </div>
      </div>
    </div>
  );
}
