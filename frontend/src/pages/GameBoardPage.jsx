import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DIFFICULTIES = [300, 600, 900];

/* ── Color palettes ── */
const LIGHT = {
  boardBg:   "linear-gradient(155deg, #F3EBD3 0%, #E4D9BB 35%, #C7D3A4 70%, #B5C592 100%)",
  cardBg:    "rgba(255,255,255,0.88)",
  cardBorder:"rgba(0,0,0,0.07)",
  textMain:  "#2C3A1A",
  textSub:   "#5A6A3A",
  scoreBg:   "rgba(44,58,26,0.92)",
  scoreBorder:"rgba(199,211,164,0.25)",
};
const DARK = {
  boardBg:   "linear-gradient(155deg, #1A2B18 0%, #1C2E1A 35%, #1F3020 70%, #172715 100%)",
  cardBg:    "rgba(28,42,26,0.95)",
  cardBorder:"rgba(120,170,90,0.18)",
  textMain:  "#C7D3A4",
  textSub:   "#8AAA68",
  scoreBg:   "rgba(10,20,8,0.95)",
  scoreBorder:"rgba(120,170,90,0.2)",
};

/* ── Score button colors (warm gold palette) ── */
const DIFF_STYLE = {
  300: { bg: "linear-gradient(145deg,#B8860B,#E8C026)", shadow: "rgba(184,134,11,0.55)", darkBg: "linear-gradient(145deg,#9A7010,#C4A01E)" },
  600: { bg: "linear-gradient(145deg,#8B4513,#CD7B3A)", shadow: "rgba(139,69,19,0.55)",  darkBg: "linear-gradient(145deg,#7A3A0F,#B06A2E)" },
  900: { bg: "linear-gradient(145deg,#5B0E14,#9A1E28)", shadow: "rgba(91,14,20,0.55)",   darkBg: "linear-gradient(145deg,#4A0A10,#801820)" },
};

function ScoreCounter({ value, dark }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (value === prev.current) return;
    setPop(true);
    const diff = value - prev.current;
    const steps = 12;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplay(Math.round(prev.current + (diff * i) / steps));
      if (i >= steps) { clearInterval(t); setDisplay(value); setPop(false); prev.current = value; }
    }, 40);
    return () => clearInterval(t);
  }, [value]);

  return (
    <span className={`font-black tabular-nums inline-block transition-transform ${pop ? "scale-125" : ""}`}
      style={{ color: "#F1E194" }}>
      {display}
    </span>
  );
}

function fireConfetti() {
  const colors = ["#F1E194","#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6"];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.left = Math.random() * 100 + "vw";
    el.style.width = (Math.random() * 10 + 5) + "px";
    el.style.height = (Math.random() * 10 + 5) + "px";
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
    el.style.animationDuration = (Math.random() * 3 + 2) + "s";
    el.style.animationDelay = Math.random() * 1 + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

/* ── Score Button ── */
function ScoreBtn({ catId, diff, slot, used, clicking, onClick, dark }) {
  const ds  = DIFF_STYLE[diff];
  const key = `${catId}_${diff}_${slot}`;
  const isClicking = clicking === key;

  return (
    <button
      data-testid={`tile-${catId}-${diff}-${slot}`}
      onClick={onClick}
      disabled={used || !!clicking}
      className={`
        w-full rounded-full font-black text-center select-none transition-all duration-150
        ${used
          ? "opacity-20 cursor-default"
          : "hover:scale-110 active:scale-95 cursor-pointer hover:-translate-y-0.5"}
      `}
      style={{
        background: used ? (dark ? "rgba(100,120,80,0.2)" : "#d1c9b5") : (dark ? ds.darkBg : ds.bg),
        boxShadow: used ? "none" : `0 5px 14px ${ds.shadow}, 0 2px 6px rgba(0,0,0,0.2)`,
        padding: "clamp(8px,1.5vh,18px) clamp(4px,0.8vw,10px)",
        fontSize: "clamp(1.6rem, 3.8vw, 3.5rem)",
        color: used ? (dark ? "rgba(140,160,100,0.35)" : "rgba(80,80,60,0.35)") : "white",
        letterSpacing: "-0.02em",
        lineHeight: 1,
        border: used ? "none" : "1px solid rgba(255,255,255,0.2)",
      }}
    >
      {isClicking ? "⏳" : used ? "✓" : diff}
    </button>
  );
}

/* ── Category Card ── */
function CategoryCard({ cat, session, isTileUsed, clickingTile, onTileClick, dark }) {
  const P = dark ? DARK : LIGHT;
  const t1Cats   = session?.team1_categories || [];
  const isT1     = t1Cats.includes(cat.id);
  const teamName = isT1 ? session?.team1_name : session?.team2_name;
  const teamColor= isT1 ? "#ef4444" : "#3b82f6";

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden transition-all duration-300"
      style={{
        background: P.cardBg,
        border: `2px solid ${P.cardBorder}`,
        boxShadow: dark
          ? "0 4px 20px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)"
          : "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {/* Team indicator strip */}
      <div className="h-1.5 w-full shrink-0" style={{ background: teamColor, opacity: 0.8 }} />

      {/* Content: [left buttons | center image | right buttons] */}
      <div className="flex-1 flex flex-row items-stretch gap-1.5 px-1.5 py-2">

        {/* Left column: slot 1 buttons */}
        <div className="flex flex-col justify-around gap-1.5 shrink-0" style={{ minWidth: "clamp(65px,11vw,140px)" }}>
          {DIFFICULTIES.map(diff => (
            <ScoreBtn
              key={`${cat.id}_${diff}_1`}
              catId={cat.id} diff={diff} slot={1}
              used={isTileUsed(`${cat.id}_${diff}_1`)}
              clicking={clickingTile}
              onClick={() => onTileClick(cat.id, diff, 1)}
              dark={dark}
            />
          ))}
        </div>

        {/* Center: large image + title */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 py-1">
          <div
            className="rounded-xl overflow-hidden flex items-center justify-center mb-2"
            style={{
              width:  "clamp(90px, 16vw, 230px)",
              height: "clamp(90px, 16vw, 230px)",
              background: `linear-gradient(135deg, ${cat.color || "#5B0E14"}44, ${cat.color || "#5B0E14"}11)`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              flexShrink: 0,
            }}
          >
            {cat.image_url ? (
              <img
                src={cat.image_url}
                alt={cat.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ) : (
              <span style={{ fontSize: "clamp(3rem, 6vw, 5rem)" }}>{cat.icon || "🎯"}</span>
            )}
          </div>

          {/* Category name */}
          <div
            className="font-black text-center leading-tight"
            style={{
              color: P.textMain,
              fontSize: "clamp(0.85rem, 1.8vw, 1.3rem)",
              fontFamily: "Cairo, sans-serif",
              maxWidth: "200px",
            }}
          >
            {cat.name}
          </div>

          {/* Team badge */}
          <div
            className="mt-0.5 font-bold px-2 py-0.5 rounded-full"
            style={{
              background: `${teamColor}18`,
              color: teamColor,
              border: `1px solid ${teamColor}33`,
              fontSize: "clamp(0.65rem, 1.2vw, 0.9rem)",
            }}
          >
            {teamName}
          </div>
        </div>

        {/* Right column: slot 2 buttons */}
        <div className="flex flex-col justify-around gap-1.5 shrink-0" style={{ minWidth: "clamp(65px,11vw,140px)" }}>
          {DIFFICULTIES.map(diff => (
            <ScoreBtn
              key={`${cat.id}_${diff}_2`}
              catId={cat.id} diff={diff} slot={2}
              used={isTileUsed(`${cat.id}_${diff}_2`)}
              clicking={clickingTile}
              onClick={() => onTileClick(cat.id, diff, 2)}
              dark={dark}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ GAME MASTER PANEL ════════════════════════ */
function GameMasterPanel({ session, teamScores, currentTurn, selectedQuestions,
  categories, adjustScoreDelta, setExactScore, setTurn, switchTurn, restoreTile, dark }) {

  const [open, setOpen]           = useState(false);
  const [adjTeam, setAdjTeam]     = useState(1);
  const [adjValue, setAdjValue]   = useState("");
  const [adjBusy, setAdjBusy]     = useState(false);
  const [editScore, setEditScore] = useState(null); // null | 1 | 2
  const [editVal, setEditVal]     = useState("");
  const [activeTab, setActiveTab] = useState("score"); // score | turn | restore

  const BG     = dark ? "rgba(8,16,6,0.98)"      : "rgba(255,252,245,0.98)";
  const TXT    = dark ? "#C7D3A4"                 : "#1a2208";
  const SUB    = dark ? "rgba(199,211,164,0.55)"  : "rgba(26,34,8,0.45)";
  const CARD   = dark ? "rgba(28,42,26,0.8)"      : "rgba(240,235,220,0.9)";
  const BORDER = dark ? "rgba(120,170,90,0.2)"    : "rgba(0,0,0,0.1)";

  const tileList = [...selectedQuestions].slice(-20).reverse();

  const parseTile = (key) => {
    const parts = key.split("_");
    const slot  = parts.pop();
    const diff  = parts.pop();
    const catId = parts.join("_");
    const cat   = categories.find(c => c.id === catId);
    return { catId, diff, slot, catName: cat?.name || catId, icon: cat?.icon || "" };
  };

  const handleAdjust = async (val) => {
    const n = parseInt(val ?? adjValue, 10);
    if (isNaN(n)) { toast.error("أدخل رقماً مثل +300 أو -200"); return; }
    setAdjBusy(true);
    await adjustScoreDelta(adjTeam, n);
    const tname = adjTeam === 1 ? session?.team1_name : session?.team2_name;
    toast.success(`${n >= 0 ? "+" : ""}${n} ← ${tname}`, { duration: 2000 });
    if (val === undefined) setAdjValue("");
    setAdjBusy(false);
  };

  const handleSetScore = async () => {
    const v = parseInt(editVal, 10);
    if (isNaN(v)) { toast.error("رقم غير صالح"); return; }
    await setExactScore(editScore, v);
    toast.success("تم تحديث النقاط مباشرة", { duration: 1500 });
    setEditScore(null); setEditVal("");
  };

  const QUICK_VALS = [300, 600, 900];
  const tabStyle = (tab) => ({
    flex: 1, padding: "7px 4px", borderRadius: "8px", fontWeight: 900,
    fontSize: "0.78rem", cursor: "pointer", transition: "all 0.15s",
    background: activeTab === tab ? "#5B0E14" : "transparent",
    color: activeTab === tab ? "#F1E194" : SUB,
    border: "none",
  });

  return (
    <>
      {/* ── Floating Toggle Button ── */}
      <button
        data-testid="gmp-toggle-btn"
        onClick={() => setOpen(o => !o)}
        title="لوحة تحكم المضيف"
        className="fixed z-50 flex items-center justify-center rounded-2xl font-black shadow-2xl transition-all hover:scale-110 active:scale-95"
        style={{
          bottom: "clamp(14px,2.5vh,24px)",
          right: "clamp(14px,2vw,24px)",
          width: "clamp(46px,5vw,60px)",
          height: "clamp(46px,5vw,60px)",
          background: open ? "#5B0E14" : "rgba(91,14,20,0.88)",
          border: "2px solid rgba(241,225,148,0.35)",
          color: "#F1E194",
          fontSize: "clamp(1.1rem,2vw,1.4rem)",
          boxShadow: "0 4px 24px rgba(91,14,20,0.6)",
        }}
      >
        {open ? "✕" : "⚙"}
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.25)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Panel ── */}
      <div
        data-testid="gmp-panel"
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{
          width: "clamp(300px,28vw,360px)",
          background: BG,
          borderLeft: `2px solid ${BORDER}`,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: open ? "-8px 0 40px rgba(0,0,0,0.35)" : "none",
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 shrink-0 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <div className="font-black" style={{ color: TXT, fontSize: "1rem" }}>⚙ لوحة المضيف</div>
            <div style={{ color: SUB, fontSize: "0.7rem" }}>تحكم كامل في اللعبة</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 font-black transition-all hover:scale-110"
            style={{ color: SUB, fontSize: "1.1rem" }}
          >
            ✕
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex px-3 py-2 gap-1 shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          {[
            { id: "score",   label: "نقاط" },
            { id: "turn",    label: "الدور" },
            { id: "restore", label: "استعادة" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={tabStyle(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

          {/* ═══ TAB: SCORE ADJUSTMENT ═══ */}
          {activeTab === "score" && (
            <>
              {/* Live Score Edit */}
              <div className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="font-black mb-2" style={{ color: TXT, fontSize: "0.8rem" }}>تعديل مباشر للنقاط</div>
                <div className="flex gap-2">
                  {[1, 2].map(t => {
                    const score  = t === 1 ? teamScores.team1 : teamScores.team2;
                    const tname  = t === 1 ? session?.team1_name : session?.team2_name;
                    const tcolor = t === 1 ? "#ef4444" : "#3b82f6";
                    return (
                      <div key={t} className="flex-1 text-center">
                        <div className="font-black truncate mb-1" style={{ color: tcolor, fontSize: "0.75rem" }}>{tname}</div>
                        {editScore === t ? (
                          <div className="flex gap-1">
                            <input
                              data-testid={`score-edit-input-t${t}`}
                              type="number"
                              autoFocus
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleSetScore(); if (e.key === "Escape") setEditScore(null); }}
                              className="w-full rounded-lg px-2 py-1 font-black text-center outline-none"
                              style={{ background: "rgba(241,225,148,0.1)", border: `1px solid ${tcolor}`, color: TXT, fontSize: "1rem" }}
                              placeholder={String(score)}
                            />
                            <button
                              data-testid={`score-edit-confirm-t${t}`}
                              onClick={handleSetScore}
                              className="rounded-lg px-2 font-black text-white transition-all hover:scale-110"
                              style={{ background: tcolor, fontSize: "0.8rem" }}
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <button
                            data-testid={`score-edit-btn-t${t}`}
                            onClick={() => { setEditScore(t); setEditVal(String(score)); }}
                            className="w-full rounded-xl py-2 font-black transition-all hover:scale-105"
                            style={{
                              background: `${tcolor}18`,
                              border: `2px solid ${tcolor}55`,
                              color: tcolor,
                              fontSize: "1.4rem",
                            }}
                          >
                            {score}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delta Adjustment */}
              <div className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="font-black mb-2" style={{ color: TXT, fontSize: "0.8rem" }}>إضافة / خصم نقاط</div>

                {/* Team selector */}
                <div className="flex gap-2 mb-3">
                  {[1, 2].map(t => {
                    const tcolor = t === 1 ? "#ef4444" : "#3b82f6";
                    const tname  = t === 1 ? session?.team1_name : session?.team2_name;
                    return (
                      <button
                        key={t}
                        data-testid={`adj-team-${t}-btn`}
                        onClick={() => setAdjTeam(t)}
                        className="flex-1 py-2 rounded-xl font-black transition-all text-sm"
                        style={{
                          background: adjTeam === t ? `${tcolor}` : `${tcolor}15`,
                          border: `2px solid ${tcolor}`,
                          color: adjTeam === t ? "white" : tcolor,
                        }}
                      >
                        {tname}
                      </button>
                    );
                  })}
                </div>

                {/* Quick buttons + / - */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {QUICK_VALS.map(v => (
                    <button
                      key={`+${v}`}
                      data-testid={`adj-plus-${v}-btn`}
                      onClick={() => handleAdjust(`+${v}`)}
                      disabled={adjBusy}
                      className="py-2 rounded-xl font-black text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80" }}
                    >
                      +{v}
                    </button>
                  ))}
                  {QUICK_VALS.map(v => (
                    <button
                      key={`-${v}`}
                      data-testid={`adj-minus-${v}-btn`}
                      onClick={() => handleAdjust(`-${v}`)}
                      disabled={adjBusy}
                      className="py-2 rounded-xl font-black text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}
                    >
                      -{v}
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div className="flex gap-2">
                  <input
                    data-testid="adj-custom-input"
                    type="text"
                    value={adjValue}
                    onChange={e => setAdjValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAdjust(); }}
                    placeholder="مثال: +500 أو -150"
                    className="flex-1 rounded-xl px-3 py-2 font-bold outline-none"
                    style={{
                      background: dark ? "rgba(120,170,90,0.08)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${BORDER}`,
                      color: TXT,
                      fontSize: "0.85rem",
                      textAlign: "center",
                    }}
                  />
                  <button
                    data-testid="adj-apply-btn"
                    onClick={() => handleAdjust()}
                    disabled={adjBusy}
                    className="px-4 rounded-xl font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    style={{ background: "#5B0E14", color: "#F1E194", fontSize: "0.85rem" }}
                  >
                    تطبيق
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ═══ TAB: TURN CONTROL ═══ */}
          {activeTab === "turn" && (
            <div className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="font-black mb-3" style={{ color: TXT, fontSize: "0.8rem" }}>التحكم في الدور</div>

              {/* Current turn indicator */}
              <div
                className="rounded-xl px-3 py-2 text-center font-black mb-4"
                style={{
                  background: currentTurn === 1 ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                  border: `1.5px solid ${currentTurn === 1 ? "#ef4444" : "#3b82f6"}`,
                  color: currentTurn === 1 ? "#fca5a5" : "#93c5fd",
                  fontSize: "0.9rem",
                }}
              >
                الدور الحالي: {currentTurn === 1 ? `🔴 ${session?.team1_name}` : `🔵 ${session?.team2_name}`}
              </div>

              {/* Manual set turn buttons */}
              <div className="space-y-2">
                <button
                  data-testid="set-turn-1-btn"
                  onClick={() => { setTurn(1); toast.success(`الدور: ${session?.team1_name}`, { duration: 1500 }); }}
                  className="w-full py-3 rounded-xl font-black text-base transition-all hover:scale-[1.02] active:scale-95"
                  style={{
                    background: currentTurn === 1 ? "#ef4444" : "rgba(239,68,68,0.15)",
                    border: "2px solid #ef4444",
                    color: currentTurn === 1 ? "white" : "#fca5a5",
                  }}
                >
                  🔴 دور {session?.team1_name}
                </button>
                <button
                  data-testid="set-turn-2-btn"
                  onClick={() => { setTurn(2); toast.success(`الدور: ${session?.team2_name}`, { duration: 1500 }); }}
                  className="w-full py-3 rounded-xl font-black text-base transition-all hover:scale-[1.02] active:scale-95"
                  style={{
                    background: currentTurn === 2 ? "#3b82f6" : "rgba(59,130,246,0.15)",
                    border: "2px solid #3b82f6",
                    color: currentTurn === 2 ? "white" : "#93c5fd",
                  }}
                >
                  🔵 دور {session?.team2_name}
                </button>
                <button
                  data-testid="next-turn-btn"
                  onClick={() => { switchTurn(); toast.success("تبديل الدور", { duration: 1000 }); }}
                  className="w-full py-3 rounded-xl font-black text-base transition-all hover:scale-[1.02] active:scale-95"
                  style={{
                    background: dark ? "rgba(120,170,90,0.15)" : "rgba(0,0,0,0.06)",
                    border: `1.5px solid ${BORDER}`,
                    color: TXT,
                  }}
                >
                  ⇄ تبديل الدور
                </button>
              </div>
            </div>
          )}

          {/* ═══ TAB: RESTORE TILE ═══ */}
          {activeTab === "restore" && (
            <div>
              <div className="font-black mb-2" style={{ color: TXT, fontSize: "0.8rem" }}>
                استعادة سؤال (يعيد البطاقة للوحة)
              </div>
              {tileList.length === 0 ? (
                <div className="text-center py-6" style={{ color: SUB, fontSize: "0.8rem" }}>
                  لا توجد أسئلة مستخدمة حتى الآن
                </div>
              ) : (
                <div className="space-y-1.5">
                  {tileList.map((key, i) => {
                    const { catName, diff, slot, icon } = parseTile(key);
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-xl px-3 py-2"
                        style={{ background: CARD, border: `1px solid ${BORDER}` }}
                      >
                        <div>
                          <div className="font-bold" style={{ color: TXT, fontSize: "0.8rem" }}>
                            {icon} {catName}
                          </div>
                          <div style={{ color: SUB, fontSize: "0.7rem" }}>
                            {diff} نقطة — فتحة {slot}
                          </div>
                        </div>
                        <button
                          data-testid={`restore-tile-${key}`}
                          onClick={() => {
                            restoreTile(key);
                            toast.success(`تمت استعادة السؤال`, { duration: 1500 });
                          }}
                          className="px-3 py-1.5 rounded-lg font-black transition-all hover:scale-110 active:scale-95"
                          style={{
                            background: "rgba(34,197,94,0.15)",
                            border: "1px solid rgba(34,197,94,0.4)",
                            color: "#4ade80",
                            fontSize: "0.75rem",
                          }}
                        >
                          استعادة
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════ Main Board ═══ */
export default function GameBoardPage() {
  const navigate = useNavigate();
  const {
    session, resetGame, darkMode, toggleDarkMode, currentTurn, switchTurn,
    markTileUsed, isTileUsed, selectedQuestions, teamScores, saveSession,
    adjustScoreDelta, setExactScore, setTurn, restoreTile
  } = useGame();
  const [categories, setCategories]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showWinner, setShowWinner]         = useState(false);
  const [clickingTile, setClickingTile]     = useState(null);

  const P = darkMode ? DARK : LIGHT;

  useEffect(() => {
    if (!session) { navigate("/"); return; }
    loadBoard();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!session) return;
    // selectedQuestions and teamScores are managed by GameContext
  }, [session]);

  const loadBoard = async () => {
    const allIds = [...(session?.team1_categories || []), ...(session?.team2_categories || [])];
    const { data: all } = await axios.get(`${API}/categories`);
    setCategories(allIds.map(id => all.find(c => c.id === id)).filter(Boolean));
    setLoading(false);
  };

  const refreshScores = useCallback(async () => {
    if (!session?.id) return;
    try {
      const { data } = await axios.get(`${API}/game/session/${session.id}`);
      saveSession({ ...session, team1_score: data.team1_score, team2_score: data.team2_score });
    } catch {}
  }, [session, saveSession]);

  useEffect(() => { const iv = setInterval(refreshScores, 4000); return () => clearInterval(iv); }, [refreshScores]);
  useEffect(() => {
    const h = () => refreshScores();
    window.addEventListener("scoreUpdated", h);
    return () => window.removeEventListener("scoreUpdated", h);
  }, [refreshScores]);

  const handleTileClick = async (catId, difficulty, slot) => {
    const key = `${catId}_${difficulty}_${slot}`;
    if (isTileUsed(key) || clickingTile) return;
    setClickingTile(key);
    // Mark tile immediately to prevent race conditions
    markTileUsed(key);
    try {
      const { data: q } = await axios.post(
        `${API}/game/session/${session.id}/question?category_id=${catId}&difficulty=${difficulty}`
      );
      navigate("/question", {
        state: { question: q, catId, difficulty, slot, catName: categories.find(c => c.id === catId)?.name, turnTeam: currentTurn }
      });
    } catch {
      toast.error("لا يوجد أسئلة متاحة لهذه الفئة!");
    } finally {
      setClickingTile(null);
    }
  };

  const handleEndGame = () => { fireConfetti(); setShowEndConfirm(false); setShowWinner(true); };

  if (loading) return (
    <div className="h-screen flex items-center justify-center" style={{ background: P.boardBg }}>
      <div className="text-xl font-bold animate-pulse" style={{ color: P.textMain }}>جاري تحميل اللوحة...</div>
    </div>
  );

  const allUsed = categories.every(c =>
    DIFFICULTIES.every(d => isTileUsed(`${c.id}_${d}_1`) && isTileUsed(`${c.id}_${d}_2`))
  );
  const winner = allUsed || showWinner
    ? teamScores.team1 > teamScores.team2 ? session?.team1_name
    : teamScores.team2 > teamScores.team1 ? session?.team2_name : "تعادل"
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ minHeight: "100svh", background: P.boardBg }}>

      {/* ── Score Bar ── */}
      <div
        className="shrink-0 border-b"
        style={{ background: P.scoreBg, borderColor: P.scoreBorder }}
      >
        <div className="flex items-center justify-between px-3 md:px-5 py-2 md:py-3 gap-2 md:gap-4">

          {/* ── Team 1 Score Block ── */}
          <div
            data-testid="team1-score"
            className="flex flex-col items-center justify-center rounded-2xl px-3 md:px-6 py-2 md:py-3 transition-all duration-500 flex-1"
            style={{
              background:  currentTurn === 1 ? "rgba(239,68,68,0.22)" : "rgba(239,68,68,0.07)",
              border:      `2.5px solid ${currentTurn === 1 ? "rgba(239,68,68,0.85)" : "rgba(239,68,68,0.22)"}`,
              boxShadow:   currentTurn === 1 ? "0 0 22px rgba(239,68,68,0.45), 0 0 50px rgba(239,68,68,0.15)" : "none",
              minWidth:    "clamp(120px,18vw,260px)",
              maxWidth:    "300px",
            }}
          >
            <span
              className="font-black text-red-300 leading-tight text-center truncate w-full mb-0.5"
              style={{ fontSize: "clamp(1.1rem, 2.8vw, 2.2rem)", maxWidth: "260px" }}
            >
              🔴 {session?.team1_name}
            </span>
            <span
              className="font-black tabular-nums leading-none"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4.2rem)", color: "#F1E194" }}
            >
              <ScoreCounter value={teamScores.team1} dark={darkMode} />
            </span>
          </div>

          {/* ── Center: Logo + LARGE Turn Indicator + Controls ── */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {/* Game title */}
            <div
              className="font-black text-yellow-200 leading-none"
              style={{ fontSize: "clamp(1rem, 1.8vw, 1.4rem)", fontFamily: "Cairo, sans-serif" }}
            >
              حُجّة
            </div>

            {/* ═══ LARGE TURN INDICATOR ═══ */}
            <div
              data-testid="turn-indicator"
              className="flex items-center gap-2 rounded-xl font-black transition-all duration-500 text-center"
              style={{
                background:   currentTurn === 1 ? "rgba(239,68,68,0.30)" : "rgba(59,130,246,0.30)",
                border:       `2.5px solid ${currentTurn === 1 ? "rgba(239,68,68,0.9)" : "rgba(59,130,246,0.9)"}`,
                color:        currentTurn === 1 ? "#fca5a5" : "#93c5fd",
                fontSize:     "clamp(0.8rem, 2vw, 1.3rem)",
                padding:      "clamp(5px,0.9vh,12px) clamp(12px,1.8vw,24px)",
                boxShadow:    currentTurn === 1
                  ? "0 0 24px rgba(239,68,68,0.6), 0 0 50px rgba(239,68,68,0.2)"
                  : "0 0 24px rgba(59,130,246,0.6), 0 0 50px rgba(59,130,246,0.2)",
                whiteSpace:   "nowrap",
                animation:    "pulse 1.8s ease-in-out infinite",
              }}
            >
              <span style={{ fontSize: "clamp(1rem, 1.8vw, 1.4rem)" }}>{currentTurn === 1 ? "🔴" : "🔵"}</span>
              <span>دور {currentTurn === 1 ? session?.team1_name : session?.team2_name}</span>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2 mt-0.5">
              <button
                data-testid="dark-mode-toggle"
                onClick={toggleDarkMode}
                title={darkMode ? "الوضع الفاتح" : "الوضع الداكن"}
                className="flex items-center gap-1.5 font-bold rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: darkMode ? "rgba(120,170,90,0.3)" : "rgba(200,200,150,0.2)",
                  color:      darkMode ? "#C7D3A4" : "#F1E194",
                  border:     `1.5px solid ${darkMode ? "rgba(120,170,90,0.5)" : "rgba(241,225,148,0.3)"}`,
                  fontSize:   "clamp(0.65rem, 1.2vw, 0.85rem)",
                  padding:    "clamp(3px,0.5vh,7px) clamp(8px,1.2vw,14px)",
                }}
              >
                <span>{darkMode ? "☀️" : "🌙"}</span>
                <span>{darkMode ? "فاتح" : "داكن"}</span>
              </button>
              <button
                data-testid="end-game-btn"
                onClick={() => setShowEndConfirm(true)}
                className="font-bold rounded-full transition-all duration-200 hover:scale-105 hover:opacity-80"
                style={{
                  color:    "rgba(241,225,148,0.4)",
                  border:   "1px solid rgba(241,225,148,0.15)",
                  fontSize: "clamp(0.6rem, 1vw, 0.75rem)",
                  padding:  "clamp(3px,0.4vh,6px) clamp(6px,1vw,12px)",
                }}
              >
                إنهاء
              </button>
            </div>
          </div>

          {/* ── Team 2 Score Block ── */}
          <div
            data-testid="team2-score"
            className="flex flex-col items-center justify-center rounded-2xl px-3 md:px-6 py-2 md:py-3 transition-all duration-500 flex-1"
            style={{
              background:  currentTurn === 2 ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.07)",
              border:      `2.5px solid ${currentTurn === 2 ? "rgba(59,130,246,0.85)" : "rgba(59,130,246,0.22)"}`,
              boxShadow:   currentTurn === 2 ? "0 0 22px rgba(59,130,246,0.45), 0 0 50px rgba(59,130,246,0.15)" : "none",
              minWidth:    "clamp(120px,18vw,260px)",
              maxWidth:    "300px",
            }}
          >
            <span
              className="font-black text-blue-300 leading-tight text-center truncate w-full text-center mb-0.5"
              style={{ fontSize: "clamp(1.1rem, 2.8vw, 2.2rem)", maxWidth: "260px" }}
            >
              {session?.team2_name} 🔵
            </span>
            <span
              className="font-black tabular-nums leading-none"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4.2rem)", color: "#F1E194" }}
            >
              <ScoreCounter value={teamScores.team2} dark={darkMode} />
            </span>
          </div>

        </div>
      </div>

      {/* ── Game Board: responsive grid — 3 cols × 2 rows on small, 6 cols × 1 row on wide ── */}
      <div
        className="flex-1 p-2 md:p-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridAutoRows: "1fr",
          gap: "clamp(6px, 1.2vw, 16px)",
          overflow: "hidden",
        }}
      >
        {categories.slice(0, 6).map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            session={session}
            isTileUsed={isTileUsed}
            clickingTile={clickingTile}
            onTileClick={handleTileClick}
            dark={darkMode}
          />
        ))}
      </div>

      {/* ── Game Master Panel ── */}
      <GameMasterPanel
        session={session}
        teamScores={teamScores}
        currentTurn={currentTurn}
        selectedQuestions={selectedQuestions}
        categories={categories}
        adjustScoreDelta={adjustScoreDelta}
        setExactScore={setExactScore}
        setTurn={setTurn}
        switchTurn={switchTurn}
        restoreTile={restoreTile}
        dark={darkMode}
      />

      {/* ── Legend ── */}
      <div className="shrink-0 flex justify-center gap-6 pb-1.5 pt-0.5">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-500 ${currentTurn === 1 ? "bg-red-500/20" : ""}`}>
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="font-bold" style={{ color: P.textSub, fontSize: "clamp(0.65rem, 1.2vw, 0.85rem)" }}>{session?.team1_name}</span>
          {currentTurn === 1 && <span className="text-red-400 font-black" style={{ fontSize: "clamp(0.55rem, 1vw, 0.7rem)" }}>← دوره</span>}
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-500 ${currentTurn === 2 ? "bg-blue-500/20" : ""}`}>
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="font-bold" style={{ color: P.textSub, fontSize: "clamp(0.65rem, 1.2vw, 0.85rem)" }}>{session?.team2_name}</span>
          {currentTurn === 2 && <span className="text-blue-400 font-black" style={{ fontSize: "clamp(0.55rem, 1vw, 0.7rem)" }}>← دوره</span>}
        </div>
      </div>

      {/* ── All-used banner ── */}
      {allUsed && !showWinner && (
        <div
          className="fixed bottom-0 inset-x-0 p-4 text-center z-40 border-t-4"
          style={{ background: "#F1E194", borderColor: "#5B0E14" }}
        >
          <div className="text-primary font-black text-xl mb-3">
            {winner === "تعادل" ? "🤝 تعادل!" : `🏆 ${winner} فاز!`}
          </div>
          <button
            onClick={() => { fireConfetti(); setShowWinner(true); }}
            className="bg-primary text-secondary px-8 py-3 rounded-full font-black text-lg hover:scale-105 transition-all"
          >
            عرض النتيجة النهائية
          </button>
        </div>
      )}

      {/* ── End Confirm ── */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center animate-scale-in shadow-2xl">
            <div className="text-2xl font-black mb-2 text-primary">إنهاء اللعبة؟</div>
            <div className="text-gray-500 mb-6 text-sm">سيتم إعلان الفائز الحالي</div>
            <div className="flex gap-3 justify-center">
              <button onClick={handleEndGame} className="bg-primary text-secondary px-6 py-3 rounded-full font-black hover:scale-105 transition-all">
                نعم، إنهاء
              </button>
              <button onClick={() => setShowEndConfirm(false)} className="border-2 border-gray-200 text-gray-500 px-6 py-3 rounded-full font-bold hover:bg-gray-50 transition-all">
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Winner Screen ── */}
      {showWinner && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50 px-6 text-center" style={{ background: P.boardBg }}>
          <div className="text-7xl md:text-9xl mb-4">🏆</div>
          <div className="text-lg font-bold mb-2" style={{ color: P.textMain, opacity: 0.6 }}>الفائز</div>
          <div
            className="text-5xl md:text-7xl font-black mb-4 animate-winner-glow"
            style={{ color: "#5B0E14", fontFamily: "Cairo,sans-serif", textShadow: "0 4px 20px rgba(91,14,20,0.3)" }}
          >
            {winner === "تعادل" ? "🤝 تعادل!" : winner}
          </div>
          <div className="flex gap-8 mb-8">
            <div className="text-center rounded-2xl px-6 py-4" style={{ background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)" }}>
              <div className="text-red-500 text-sm font-bold mb-1">{session?.team1_name}</div>
              <div className="text-3xl font-black" style={{ color: P.textMain }}>{teamScores.team1}</div>
            </div>
            <div className="flex items-center text-gray-400 text-xl">VS</div>
            <div className="text-center rounded-2xl px-6 py-4" style={{ background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)" }}>
              <div className="text-blue-500 text-sm font-bold mb-1">{session?.team2_name}</div>
              <div className="text-3xl font-black" style={{ color: P.textMain }}>{teamScores.team2}</div>
            </div>
          </div>
          <button
            onClick={() => { resetGame(); navigate("/"); }}
            className="bg-primary text-secondary px-10 py-4 rounded-full font-black text-xl hover:scale-105 animate-pulse-glow transition-all"
          >
            🎮 لعبة جديدة
          </button>
        </div>
      )}
    </div>
  );
}
