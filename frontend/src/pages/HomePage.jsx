import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { Play } from "lucide-react";

/* ═══════════════════════════════════════════════════════
   لوحات فنية رومانية وفلسفية — public domain (Wikimedia)
   ═══════════════════════════════════════════════════════ */
const PAINTINGS = [
  /* ── صف أول (أعلى) ── */
  {
    id: 1,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Jean-Leon_Gerome_Pollice_Verso.jpg/1280px-Jean-Leon_Gerome_Pollice_Verso.jpg",
    alt: "المصارع في الميدان — جان-ليون جيروم",
    style: { top: "1%",  left: "0%",  width: "22%", height: "52%" },
    rotate: "0.8deg",
    mobileVisible: true,
  },
  {
    id: 2,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg/1280px-%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg",
    alt: "مدرسة أثينا — رافائيل",
    style: { top: "-3%", left: "20%", width: "44%", height: "46%" },
    rotate: "-0.4deg",
    mobileVisible: true,
  },
  {
    id: 3,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Vincenzo_Camuccini%2C_Morte_di_Cesare.jpg/1280px-Vincenzo_Camuccini%2C_Morte_di_Cesare.jpg",
    alt: "مقتل قيصر — فينتشينزو كامُتشيني",
    style: { top: "0%",  left: "63%", width: "38%", height: "42%" },
    rotate: "0.6deg",
    mobileVisible: false,
  },
  /* ── صف ثاني (وسط) ── */
  {
    id: 4,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Aristotle_with_a_Bust_of_Homer.jpg/926px-Aristotle_with_a_Bust_of_Homer.jpg",
    alt: "أرسطو مع تمثال هوميروس — رامبرانت",
    style: { top: "41%", left: "0%",  width: "21%", height: "58%" },
    rotate: "-0.7deg",
    mobileVisible: false,
  },
  {
    id: 5,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Jacques-Louis_David_-_Oath_of_the_Horatii_-_Google_Art_Project.jpg/1280px-Jacques-Louis_David_-_Oath_of_the_Horatii_-_Google_Art_Project.jpg",
    alt: "قسم الهوراتيي — جاك-لويس دافيد",
    style: { top: "40%", left: "19%", width: "54%", height: "48%" },
    rotate: "0.3deg",
    mobileVisible: true,
  },
  {
    id: 6,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Jupiter_and_Thetis%2C_by_Jean_Auguste_Dominique_Ingres.jpg/778px-Jupiter_and_Thetis%2C_by_Jean_Auguste_Dominique_Ingres.jpg",
    alt: "جوبيتر وثيتيس — أنغر",
    style: { top: "37%", left: "73%", width: "28%", height: "63%" },
    rotate: "-1deg",
    mobileVisible: false,
  },
  /* ── صف ثالث (أسفل) ── */
  {
    id: 7,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Caravaggio_Judith_Beheading_Holofernes.jpg/1280px-Caravaggio_Judith_Beheading_Holofernes.jpg",
    alt: "يهوديت وهولوفيرنيس — كارافاجيو",
    style: { top: "83%", left: "2%",  width: "35%", height: "24%" },
    rotate: "1.2deg",
    mobileVisible: false,
  },
  {
    id: 8,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Jacques-Louis_David_-_Leonidas_at_Thermopylae_-_Google_Art_Project.jpg/1280px-Jacques-Louis_David_-_Leonidas_at_Thermopylae_-_Google_Art_Project.jpg",
    alt: "ليونيداس في ثيرموبيلي — دافيد",
    style: { top: "85%", left: "36%", width: "36%", height: "21%" },
    rotate: "-0.5deg",
    mobileVisible: false,
  },
  {
    id: 9,
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Alma-Tadema%2C_Lawrence_-_The_Roses_of_Heliogabalus_-_1888.jpg/1280px-Alma-Tadema%2C_Lawrence_-_The_Roses_of_Heliogabalus_-_1888.jpg",
    alt: "ورود هيليوجابالوس — ألما تاديما",
    style: { top: "87%", left: "71%", width: "31%", height: "19%" },
    rotate: "0.8deg",
    mobileVisible: false,
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { currentUser, logoutUser } = useGame();
  const [mouse, setMouse]       = useState({ x: 0, y: 0 });
  const [ready, setReady]       = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const isPremium = currentUser?.subscription_type === "premium";

  const onMouseMove = useCallback((e) => {
    setMouse({
      x: (e.clientX / window.innerWidth  - 0.5) * 18,
      y: (e.clientY / window.innerHeight - 0.5) * 12,
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    const t = setTimeout(() => setReady(true), 80);
    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("mousemove", onMouseMove);
      clearTimeout(t);
    };
  }, [onMouseMove]);

  const galleryTransform = isMobile
    ? "scale(1.06)"
    : `translate(${mouse.x}px, ${mouse.y}px) scale(1.08)`;

  return (
    <div style={{ minHeight: "100svh", overflow: "hidden", position: "relative", background: "#0f0102" }}>

      {/* ══════════════════════════════════════════════════
          LAYER 0 — معرض اللوحات الفنية
      ══════════════════════════════════════════════════ */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: 0,
          transform: galleryTransform,
          transition: "transform 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          transformOrigin: "center center",
        }}
      >
        {PAINTINGS.map((p) => {
          if (isMobile && !p.mobileVisible) return null;
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                ...p.style,
                transform: `rotate(${p.rotate})`,
                overflow: "hidden",
                border: "3px solid rgba(200,158,54,0.62)",
                outline: "1px solid rgba(0,0,0,0.88)",
                outlineOffset: "-3px",
                boxShadow: [
                  "0 0 0 6px rgba(0,0,0,0.88)",
                  "0 12px 50px rgba(0,0,0,0.97)",
                  "0 2px 8px rgba(0,0,0,0.9)",
                  "inset 0 0 24px rgba(0,0,0,0.35)",
                ].join(", "),
                opacity: ready ? 1 : 0,
                transition: "opacity 1.6s ease",
              }}
            >
              <img
                src={p.url}
                alt={p.alt}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
                loading="lazy"
              />
              <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.58) 100%)",
                pointerEvents: "none",
              }} />
            </div>
          );
        })}
      </div>

      {/* LAYER 1 — Blur + Desaturate */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 1, backdropFilter: "blur(7px) saturate(0.58)", WebkitBackdropFilter: "blur(7px) saturate(0.58)" }} />

      {/* LAYER 2 — Dark gradient */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 2,
        background: [
          "radial-gradient(ellipse 100% 55% at 50% 0%, rgba(61,8,16,0.22) 0%, transparent 70%)",
          "linear-gradient(180deg, rgba(8,0,1,0.62) 0%, rgba(42,4,9,0.50) 38%, rgba(8,0,1,0.72) 100%)",
        ].join(", "),
      }} />

      {/* LAYER 3 — Vignette */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 3,
        background: "radial-gradient(ellipse 82% 78% at 50% 48%, transparent 18%, rgba(0,0,0,0.82) 100%)",
        pointerEvents: "none",
      }} />

      {/* LAYER 4 — Ambient burgundy glow */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 4,
        background: "radial-gradient(ellipse 55% 38% at 50% 44%, rgba(91,14,20,0.26) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* ══════════════════════════════════════════════════
          LAYER 10 — UI
      ══════════════════════════════════════════════════ */}
      <div style={{ position: "relative", zIndex: 10, minHeight: "100svh", display: "flex", flexDirection: "column" }}>

        {/* ── Navbar ── */}
        <nav role="banner" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.65rem 1.25rem",
          borderBottom: "1px solid rgba(241,225,148,0.10)",
          backdropFilter: "blur(22px) saturate(1.25)",
          WebkitBackdropFilter: "blur(22px) saturate(1.25)",
          background: "rgba(8,0,1,0.52)",
          position: "sticky", top: 0, zIndex: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            {currentUser ? (
              <>
                <span style={{ color: "rgba(241,225,148,0.92)", fontSize: "0.875rem", fontWeight: 700, fontFamily: "Cairo,sans-serif" }}>
                  {currentUser.username}
                </span>
                {isPremium ? (
                  <span style={{ background: "#F1E194", color: "#2A0409", fontSize: "0.6rem", padding: "2px 8px", borderRadius: "9999px", fontWeight: 900 }}>مميز</span>
                ) : (
                  <NavPillBtn data-testid="upgrade-btn" onClick={() => navigate("/pricing")}>ترقية</NavPillBtn>
                )}
                <NavGhostBtn data-testid="logout-btn" onClick={logoutUser}>خروج</NavGhostBtn>
              </>
            ) : (
              <>
                <NavGhostBtn data-testid="login-nav-btn" onClick={() => navigate("/login")}>دخول</NavGhostBtn>
                <span style={{ color: "rgba(241,225,148,0.12)" }}>|</span>
                <NavGhostBtn data-testid="signup-nav-btn" onClick={() => navigate("/signup")}>حساب جديد</NavGhostBtn>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <NavGlassBtn onClick={() => navigate("/pricing")}>الأسعار</NavGlassBtn>
            <NavGlassBtn data-testid="admin-link" onClick={() => navigate("/admin")}>الإدارة</NavGlassBtn>
          </div>
        </nav>

        {/* ── Main Content ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1rem 3.5rem", gap: "1.5rem" }}>

          {/* Title */}
          <div style={{ textAlign: "center", animation: "fade-in-up 0.9s ease both" }}>
            <h1 style={{
              fontFamily: "Cairo, sans-serif",
              fontSize: "clamp(5.5rem, 20vw, 11rem)",
              fontWeight: 900, lineHeight: 0.95, margin: 0,
              color: "#F1E194",
              textShadow: [
                "0 0 12px rgba(241,225,148,1)",
                "0 0 35px rgba(241,225,148,0.85)",
                "0 0 80px rgba(241,225,148,0.55)",
                "0 0 150px rgba(241,225,148,0.25)",
                "0 5px 35px rgba(0,0,0,0.95)",
              ].join(", "),
              letterSpacing: "-0.02em",
            }}>
              حُجّة
            </h1>
          </div>

          {/* Subscription notice */}
          {currentUser && !isPremium && (
            <div style={{
              background: "rgba(241,225,148,0.07)", border: "1px solid rgba(241,225,148,0.18)",
              borderRadius: "0.875rem", padding: "0.6rem 1.25rem",
              maxWidth: "24rem", textAlign: "center",
              animation: "fade-in-up 0.9s ease 0.06s both",
            }}>
              <p style={{ color: "rgba(241,225,148,0.78)", fontSize: "0.8rem", margin: 0, fontFamily: "Cairo,sans-serif" }}>
                أسئلتك قد تتكرر —{" "}
                <button data-testid="pricing-inline-btn" onClick={() => navigate("/pricing")}
                  style={{ color: "#F1E194", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "Cairo,sans-serif" }}>
                  اشترك للحصول على أسئلة لا تتكرر
                </button>
              </p>
            </div>
          )}

          {/* Tagline Card */}
          <div style={{
            background: "rgba(18,1,3,0.72)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(241,225,148,0.20)", borderRadius: "1.25rem",
            padding: "1.3rem 1.75rem", maxWidth: "26rem", width: "100%", textAlign: "center",
            boxShadow: ["0 10px 44px rgba(0,0,0,0.60)", "0 0 0 1px rgba(241,225,148,0.06) inset", "0 0 28px rgba(91,14,20,0.28) inset"].join(", "),
            animation: "fade-in-up 0.9s ease 0.13s both",
          }}>
            <p style={{ color: "#F1E194", fontWeight: 700, fontSize: "1.1rem", margin: "0 0 0.35rem", fontFamily: "Cairo,sans-serif" }}>
              حيّاك في لعبة حُجّة!
            </p>
            <p style={{ color: "rgba(241,225,148,0.65)", fontSize: "0.875rem", margin: 0, lineHeight: 1.65, fontFamily: "Cairo,sans-serif" }}>
              اختبر معلوماتك وتحدّى ربعك في لعبة مليانة حماس وضحك
            </p>
          </div>

          {/* CTA */}
          <CTAButton onClick={() => navigate("/mode")} />

          {/* Steps */}
          <div role="list" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.65rem", maxWidth: "30rem", width: "100%", animation: "fade-in-up 0.9s ease 0.38s both" }}>
            <span className="sr-only">خطوات اللعب</span>
            {[
              { n: "١", t: "سمّوا الفرق",    d: "كل فريق يختار اسمه" },
              { n: "٢", t: "اختاروا الفئات", d: "٣ فئات لكل فريق"    },
              { n: "٣", t: "العب وانتصر",    d: "أجب وجمّع النقاط"    },
            ].map((s) => (
              <div key={s.n} role="listitem" style={{
                background: "rgba(14,1,2,0.65)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(241,225,148,0.13)", borderRadius: "0.875rem", padding: "0.75rem 0.5rem", textAlign: "center",
              }}>
                <div style={{ color: "#F1E194", fontSize: "1.4rem", fontWeight: 900, lineHeight: 1, fontFamily: "Cairo,sans-serif" }}>{s.n}</div>
                <div style={{ color: "#F1E194", fontWeight: 700, fontSize: "0.78rem", marginTop: "0.2rem", fontFamily: "Cairo,sans-serif" }}>{s.t}</div>
                <div style={{ color: "rgba(241,225,148,0.48)", fontSize: "0.68rem", marginTop: "0.15rem", fontFamily: "Cairo,sans-serif" }}>{s.d}</div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Mini components ── */

function NavGhostBtn({ onClick, children, "data-testid": testId }) {
  const [h, setH] = useState(false);
  return (
    <button data-testid={testId} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: "none", border: "none", color: h ? "#F1E194" : "rgba(241,225,148,0.82)", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "Cairo,sans-serif", transition: "color 0.18s", padding: "2px 4px" }}>
      {children}
    </button>
  );
}

function NavGlassBtn({ onClick, children, "data-testid": testId }) {
  const [h, setH] = useState(false);
  return (
    <button data-testid={testId} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: h ? "rgba(241,225,148,0.14)" : "rgba(241,225,148,0.07)", border: `1px solid ${h ? "rgba(241,225,148,0.55)" : "rgba(241,225,148,0.24)"}`, color: h ? "#F1E194" : "rgba(241,225,148,0.82)", fontSize: "0.8rem", fontWeight: 600, padding: "0.3rem 0.9rem", borderRadius: "0.5rem", cursor: "pointer", fontFamily: "Cairo,sans-serif", transition: "all 0.18s", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      {children}
    </button>
  );
}

function NavPillBtn({ onClick, children, "data-testid": testId }) {
  const [h, setH] = useState(false);
  return (
    <button data-testid={testId} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: "none", border: `1px solid ${h ? "rgba(241,225,148,0.9)" : "rgba(241,225,148,0.4)"}`, color: h ? "#F1E194" : "rgba(241,225,148,0.75)", fontSize: "0.6rem", fontWeight: 600, padding: "2px 10px", borderRadius: "9999px", cursor: "pointer", fontFamily: "Cairo,sans-serif", transition: "all 0.18s" }}>
      {children}
    </button>
  );
}

function CTAButton({ onClick }) {
  const [h, setH] = useState(false);
  return (
    <button data-testid="start-game-btn" onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? "linear-gradient(135deg, #F9F2C5 0%, #D4C872 100%)" : "linear-gradient(135deg, #F1E194 0%, #C5B358 100%)",
        color: "#2A0409", fontFamily: "Cairo,sans-serif", fontWeight: 900,
        fontSize: "clamp(1.1rem, 3vw, 1.45rem)",
        padding: "clamp(14px,3vw,20px) clamp(40px,7vw,68px)",
        borderRadius: "9999px", border: "2px solid rgba(241,225,148,0.45)",
        cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem",
        boxShadow: h
          ? "0 0 0 3px rgba(241,225,148,0.22), 0 0 60px rgba(241,225,148,0.58), 0 14px 44px rgba(0,0,0,0.58)"
          : "0 0 0 2px rgba(241,225,148,0.12), 0 0 40px rgba(241,225,148,0.35), 0 8px 30px rgba(0,0,0,0.5)",
        transform: h ? "scale(1.06) translateY(-2px)" : "scale(1) translateY(0)",
        transition: "all 0.26s cubic-bezier(0.34, 1.56, 0.64, 1)",
        animation: "fade-in-up 0.9s ease 0.24s both, pulse-glow 2.8s ease-in-out 1.2s infinite",
      }}>
      <Play size={20} fill="currentColor" aria-hidden="true" />
      العب الحين
    </button>
  );
}
