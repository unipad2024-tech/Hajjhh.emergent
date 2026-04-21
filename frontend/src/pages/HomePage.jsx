import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { Play } from "lucide-react";

/* ════════════════════════════════════════════════════════════════
   لوحات فنية رومانية وفلسفية — Wikimedia Commons (public domain)
   ════════════════════════════════════════════════════════════════ */
const PAINTINGS = [
  {
    id: 1,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Jean-Leon_Gerome_Pollice_Verso.jpg/1200px-Jean-Leon_Gerome_Pollice_Verso.jpg",
    alt: "المصارع في الميدان",
    s: { top: "0%", left: "0%", width: "23%", height: "54%" },
    r: "1deg", mv: true,
  },
  {
    id: 2,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg/1200px-%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg",
    alt: "مدرسة أثينا — رافائيل",
    s: { top: "-4%", left: "21%", width: "45%", height: "48%" },
    r: "-0.5deg", mv: true,
  },
  {
    id: 3,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Vincenzo_Camuccini%2C_Morte_di_Cesare.jpg/1200px-Vincenzo_Camuccini%2C_Morte_di_Cesare.jpg",
    alt: "مقتل قيصر",
    s: { top: "0%", left: "64%", width: "37%", height: "43%" },
    r: "0.7deg", mv: false,
  },
  {
    id: 4,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Aristotle_with_a_Bust_of_Homer.jpg/800px-Aristotle_with_a_Bust_of_Homer.jpg",
    alt: "أرسطو وهوميروس — رامبرانت",
    s: { top: "40%", left: "0%", width: "22%", height: "60%" },
    r: "-0.8deg", mv: false,
  },
  {
    id: 5,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Jacques-Louis_David_-_Oath_of_the_Horatii_-_Google_Art_Project.jpg/1200px-Jacques-Louis_David_-_Oath_of_the_Horatii_-_Google_Art_Project.jpg",
    alt: "قسم الهوراتيي — دافيد",
    s: { top: "39%", left: "20%", width: "55%", height: "50%" },
    r: "0.3deg", mv: true,
  },
  {
    id: 6,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Jupiter_and_Thetis%2C_by_Jean_Auguste_Dominique_Ingres.jpg/700px-Jupiter_and_Thetis%2C_by_Jean_Auguste_Dominique_Ingres.jpg",
    alt: "جوبيتر وثيتيس — أنغر",
    s: { top: "36%", left: "74%", width: "27%", height: "65%" },
    r: "-1deg", mv: false,
  },
  {
    id: 7,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Caravaggio_Judith_Beheading_Holofernes.jpg/1200px-Caravaggio_Judith_Beheading_Holofernes.jpg",
    alt: "يهوديت — كارافاجيو",
    s: { top: "83%", left: "2%", width: "36%", height: "24%" },
    r: "1.3deg", mv: false,
  },
  {
    id: 8,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Jacques-Louis_David_-_Leonidas_at_Thermopylae_-_Google_Art_Project.jpg/1200px-Jacques-Louis_David_-_Leonidas_at_Thermopylae_-_Google_Art_Project.jpg",
    alt: "ليونيداس — دافيد",
    s: { top: "85%", left: "37%", width: "35%", height: "21%" },
    r: "-0.5deg", mv: false,
  },
  {
    id: 9,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Alma-Tadema%2C_Lawrence_-_The_Roses_of_Heliogabalus_-_1888.jpg/1200px-Alma-Tadema%2C_Lawrence_-_The_Roses_of_Heliogabalus_-_1888.jpg",
    alt: "ورود هيليوجابالوس — ألما تاديما",
    s: { top: "87%", left: "71%", width: "30%", height: "19%" },
    r: "0.9deg", mv: false,
  },
];

/* ══════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const navigate    = useNavigate();
  const { currentUser, logoutUser } = useGame();
  const [mouse, setMouse]   = useState({ x: 0, y: 0 });
  const [mobile, setMobile] = useState(false);

  const isPremium = currentUser?.subscription_type === "premium";

  /* parallax */
  const onMove = useCallback((e) => {
    setMouse({
      x: (e.clientX / window.innerWidth  - 0.5) * 16,
      y: (e.clientY / window.innerHeight - 0.5) * 10,
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setMobile(mq.matches);
    const h = (e) => setMobile(e.matches);
    mq.addEventListener("change", h);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { mq.removeEventListener("change", h); window.removeEventListener("mousemove", onMove); };
  }, [onMove]);

  /* ── الطبقات ──────────────────────────────────────────────────
     0: gallery (filter مباشر — هذا الصح، مش backdrop-filter)
     1: dark gradient overlay (خفيف)
     2: vignette
     3: burgundy center glow
     10+: UI
  ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight:"100svh", overflow:"hidden", position:"relative", background:"#0f0102" }}>

      {/* ═══ LAYER 0 — gallery: filter مباشر على الحاوية كاملها ═══ */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: "-5%",          /* يطغى على الأطراف */
          zIndex: 0,
          transform: mobile
            ? "scale(1.08)"
            : `translate(${mouse.x}px,${mouse.y}px) scale(1.1)`,
          transition: "transform 1.2s cubic-bezier(0.25,0.46,0.45,0.94)",
          /* ✅ filter مباشر = يبلّر اللوحات نفسها (أكثر موثوقية من backdrop-filter) */
          filter: "blur(4px) saturate(0.72) brightness(0.85)",
        }}
      >
        {PAINTINGS.map((p) => {
          if (mobile && !p.mv) return null;
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                ...p.s,
                transform: `rotate(${p.r})`,
                overflow: "hidden",
                /* إطار ذهبي مزدوج */
                border: "3px solid rgba(200,158,54,0.70)",
                boxShadow: [
                  "0 0 0 1px rgba(120,90,20,0.9)",
                  "0 0 0 7px rgba(0,0,0,0.92)",
                  "0 16px 56px rgba(0,0,0,0.98)",
                  "inset 0 0 18px rgba(0,0,0,0.25)",
                ].join(","),
              }}
            >
              <img
                src={p.url}
                alt={p.alt}
                style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center top", display:"block" }}
                loading="lazy"
                decoding="async"
              />
              {/* ظل داخلي كل لوحة — يضيف عمق */}
              <div style={{
                position:"absolute", inset:0,
                background:"radial-gradient(ellipse at center,transparent 28%,rgba(0,0,0,0.50) 100%)",
                pointerEvents:"none",
              }}/>
            </div>
          );
        })}
      </div>

      {/* ═══ LAYER 1 — dark overlay (خفيف — ٤٠٪ فقط) ═══ */}
      <div aria-hidden="true" style={{
        position:"fixed", inset:0, zIndex:1, pointerEvents:"none",
        background:"linear-gradient(180deg,rgba(5,0,1,0.42) 0%,rgba(30,3,6,0.34) 45%,rgba(5,0,1,0.50) 100%)",
      }}/>

      {/* ═══ LAYER 2 — vignette ═══ */}
      <div aria-hidden="true" style={{
        position:"fixed", inset:0, zIndex:2, pointerEvents:"none",
        background:"radial-gradient(ellipse 80% 75% at 50% 46%,transparent 22%,rgba(0,0,0,0.72) 100%)",
      }}/>

      {/* ═══ LAYER 3 — توهج برجندي محوري ═══ */}
      <div aria-hidden="true" style={{
        position:"fixed", inset:0, zIndex:3, pointerEvents:"none",
        background:"radial-gradient(ellipse 50% 34% at 50% 42%,rgba(91,14,20,0.32) 0%,transparent 100%)",
      }}/>

      {/* ═══ LAYER 10 — UI ═══ */}
      <div style={{ position:"relative", zIndex:10, minHeight:"100svh", display:"flex", flexDirection:"column" }}>

        {/* ── Navbar ── */}
        <nav role="banner" style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0.65rem 1.25rem",
          borderBottom:"1px solid rgba(241,225,148,0.12)",
          backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
          background:"rgba(5,0,1,0.55)",
          position:"sticky", top:0, zIndex:20,
        }}>
          {/* يسار */}
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
            {currentUser ? (
              <>
                <span style={NAV_LABEL}>{currentUser.username}</span>
                {isPremium
                  ? <span style={BADGE_PREMIUM}>مميز</span>
                  : <GlassBtn xs onClick={() => navigate("/pricing")} testId="upgrade-btn">ترقية</GlassBtn>
                }
                <GhostBtn onClick={logoutUser} testId="logout-btn">خروج</GhostBtn>
              </>
            ) : (
              <>
                <GhostBtn onClick={() => navigate("/login")}  testId="login-nav-btn">دخول</GhostBtn>
                <span style={{ color:"rgba(241,225,148,0.12)" }}>|</span>
                <GhostBtn onClick={() => navigate("/signup")} testId="signup-nav-btn">حساب جديد</GhostBtn>
              </>
            )}
          </div>
          {/* يمين — مرئية وواضحة */}
          <div style={{ display:"flex", gap:"0.4rem" }}>
            <GlassBtn onClick={() => navigate("/pricing")}>الأسعار</GlassBtn>
            <GlassBtn onClick={() => navigate("/admin")} testId="admin-link">الإدارة</GlassBtn>
          </div>
        </nav>

        {/* ── Main ── */}
        <main style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem 1rem 3.5rem", gap:"1.4rem" }}>

          {/* العنوان الرئيسي */}
          <div style={{ textAlign:"center", animation:"fade-in-up 0.8s ease both" }}>
            <h1 style={{
              fontFamily:"Cairo,sans-serif",
              fontSize:"clamp(5.5rem,20vw,11rem)",
              fontWeight:900, lineHeight:0.95, margin:0,
              color:"#F1E194",
              textShadow:[
                "0 0 10px #F1E194",
                "0 0 30px rgba(241,225,148,0.88)",
                "0 0 70px rgba(241,225,148,0.55)",
                "0 0 140px rgba(241,225,148,0.22)",
                "0 6px 32px rgba(0,0,0,0.98)",
              ].join(","),
            }}>حُجّة</h1>
          </div>

          {/* إشعار المشتركين */}
          {currentUser && !isPremium && (
            <div style={NOTICE_BOX}>
              <p style={{ color:"rgba(241,225,148,0.80)", fontSize:"0.8rem", margin:0, fontFamily:"Cairo,sans-serif" }}>
                أسئلتك قد تتكرر —{" "}
                <button data-testid="pricing-inline-btn" onClick={() => navigate("/pricing")}
                  style={{ color:"#F1E194", fontWeight:700, background:"none", border:"none", cursor:"pointer", textDecoration:"underline", fontFamily:"Cairo,sans-serif" }}>
                  اشترك للحصول على أسئلة لا تتكرر
                </button>
              </p>
            </div>
          )}

          {/* بطاقة الترحيب */}
          <div style={{ ...CARD_GLASS, animation:"fade-in-up 0.8s ease 0.12s both" }}>
            <p style={{ color:"#F1E194", fontWeight:700, fontSize:"1.1rem", margin:"0 0 0.32rem", fontFamily:"Cairo,sans-serif" }}>
              حيّاك في لعبة حُجّة!
            </p>
            <p style={{ color:"rgba(241,225,148,0.65)", fontSize:"0.875rem", margin:0, lineHeight:1.65, fontFamily:"Cairo,sans-serif" }}>
              اختبر معلوماتك وتحدّى ربعك في لعبة مليانة حماس وضحك
            </p>
          </div>

          {/* زر اللعب */}
          <CTABtn onClick={() => navigate("/mode")} />

          {/* الخطوات */}
          <div role="list" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0.6rem", maxWidth:"30rem", width:"100%", animation:"fade-in-up 0.8s ease 0.35s both" }}>
            {STEPS.map((s) => (
              <div key={s.n} role="listitem" style={STEP_CARD}>
                <div style={{ color:"#F1E194", fontSize:"1.4rem", fontWeight:900, lineHeight:1, fontFamily:"Cairo,sans-serif" }}>{s.n}</div>
                <div style={{ color:"#F1E194", fontWeight:700, fontSize:"0.78rem", marginTop:"0.18rem", fontFamily:"Cairo,sans-serif" }}>{s.t}</div>
                <div style={{ color:"rgba(241,225,148,0.48)", fontSize:"0.68rem", marginTop:"0.12rem", fontFamily:"Cairo,sans-serif" }}>{s.d}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Static data
   ════════════════════════════════════════════════════════════════ */
const STEPS = [
  { n:"١", t:"سمّوا الفرق",    d:"كل فريق يختار اسمه" },
  { n:"٢", t:"اختاروا الفئات", d:"٣ فئات لكل فريق"    },
  { n:"٣", t:"العب وانتصر",    d:"أجب وجمّع النقاط"    },
];

/* ════════════════════════════════════════════════════════════════
   Shared styles
   ════════════════════════════════════════════════════════════════ */
const NAV_LABEL    = { color:"rgba(241,225,148,0.92)", fontSize:"0.875rem", fontWeight:700, fontFamily:"Cairo,sans-serif" };
const BADGE_PREMIUM = { background:"#F1E194", color:"#2A0409", fontSize:"0.6rem", padding:"2px 8px", borderRadius:"9999px", fontWeight:900 };
const NOTICE_BOX   = { background:"rgba(241,225,148,0.07)", border:"1px solid rgba(241,225,148,0.18)", borderRadius:"0.875rem", padding:"0.6rem 1.25rem", maxWidth:"24rem", textAlign:"center", animation:"fade-in-up 0.8s ease 0.06s both" };
const CARD_GLASS   = { background:"rgba(12,1,2,0.74)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", border:"1px solid rgba(241,225,148,0.20)", borderRadius:"1.25rem", padding:"1.3rem 1.75rem", maxWidth:"26rem", width:"100%", textAlign:"center", boxShadow:"0 10px 44px rgba(0,0,0,0.62),0 0 0 1px rgba(241,225,148,0.06) inset,0 0 28px rgba(91,14,20,0.30) inset" };
const STEP_CARD    = { background:"rgba(10,0,1,0.66)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(241,225,148,0.13)", borderRadius:"0.875rem", padding:"0.72rem 0.5rem", textAlign:"center" };

/* ════════════════════════════════════════════════════════════════
   Mini components
   ════════════════════════════════════════════════════════════════ */
function GhostBtn({ onClick, children, testId }) {
  const [h, sH] = useState(false);
  return (
    <button data-testid={testId} onClick={onClick}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{ background:"none", border:"none", color: h ? "#F1E194" : "rgba(241,225,148,0.82)", fontSize:"0.85rem", fontWeight:700, cursor:"pointer", fontFamily:"Cairo,sans-serif", transition:"color 0.18s", padding:"2px 4px" }}>
      {children}
    </button>
  );
}

function GlassBtn({ onClick, children, testId, xs }) {
  const [h, sH] = useState(false);
  return (
    <button data-testid={testId} onClick={onClick}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{
        background: h ? "rgba(241,225,148,0.15)" : "rgba(241,225,148,0.07)",
        border: `1px solid ${h ? "rgba(241,225,148,0.58)" : "rgba(241,225,148,0.24)"}`,
        color: h ? "#F1E194" : "rgba(241,225,148,0.82)",
        fontSize: xs ? "0.6rem" : "0.8rem",
        fontWeight: xs ? 600 : 600,
        padding: xs ? "2px 10px" : "0.28rem 0.9rem",
        borderRadius: xs ? "9999px" : "0.5rem",
        cursor:"pointer", fontFamily:"Cairo,sans-serif",
        transition:"all 0.18s",
        backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
      }}>
      {children}
    </button>
  );
}

function CTABtn({ onClick }) {
  const [h, sH] = useState(false);
  return (
    <button data-testid="start-game-btn" onClick={onClick}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{
        background: h ? "linear-gradient(135deg,#F9F2C5 0%,#D4C872 100%)" : "linear-gradient(135deg,#F1E194 0%,#C5B358 100%)",
        color:"#2A0409", fontFamily:"Cairo,sans-serif", fontWeight:900,
        fontSize:"clamp(1.1rem,3vw,1.45rem)",
        padding:"clamp(14px,3vw,20px) clamp(40px,7vw,68px)",
        borderRadius:"9999px",
        border:"2px solid rgba(241,225,148,0.5)",
        cursor:"pointer",
        display:"flex", alignItems:"center", gap:"0.5rem",
        boxShadow: h
          ? "0 0 0 3px rgba(241,225,148,0.22),0 0 55px rgba(241,225,148,0.60),0 14px 44px rgba(0,0,0,0.60)"
          : "0 0 0 2px rgba(241,225,148,0.14),0 0 38px rgba(241,225,148,0.38),0 8px 30px rgba(0,0,0,0.55)",
        transform: h ? "scale(1.06) translateY(-2px)" : "scale(1) translateY(0)",
        transition:"all 0.26s cubic-bezier(0.34,1.56,0.64,1)",
        animation:"fade-in-up 0.8s ease 0.22s both, pulse-glow 2.8s ease-in-out 1.2s infinite",
      }}>
      <Play size={20} fill="currentColor" aria-hidden="true" />
      العب الحين
    </button>
  );
}
