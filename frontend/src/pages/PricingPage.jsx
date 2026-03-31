import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

const PLANS = [
  {
    id: "monthly",
    name: "المميز الشهري",
    price: "29.99",
    period: "/ شهرياً",
    features: [
      "أسئلة عشوائية لا تتكرر أبداً",
      "الوصول لجميع الفئات (10 فئات)",
      "تتبع تقدمك عبر الجلسات",
      "إحصاءات مباراتك",
    ],
  },
  {
    id: "annual",
    name: "المميز السنوي",
    price: "239.99",
    period: "/ سنوياً",
    badge: "وفّر 33%",
    features: [
      "كل مميزات الخطة الشهرية",
      "توفير 33% مقارنة بالشهري",
      "دعم أولوي",
    ],
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { currentUser, userToken } = useGame();
  const [loading, setLoading]           = useState(null);
  const [showForm, setShowForm]         = useState(null); // plan id
  const [clientName, setClientName]     = useState("");
  const [clientMobile, setClientMobile] = useState("");

  const openForm = (planId) => {
    if (!currentUser) { toast.info("سجّل دخولك أولاً للاشتراك"); navigate("/login"); return; }
    if (currentUser.subscription_type === "premium") { toast.info("أنت مشترك مميز بالفعل!"); return; }
    setShowForm(planId);
  };

  const handleUpgrade = async () => {
    if (!clientName.trim()) { toast.error("يرجى إدخال الاسم"); return; }
    if (!clientMobile.trim()) { toast.error("يرجى إدخال رقم الجوال"); return; }
    if (!/^(05|5|966\d|00966\d)\d{7,8}$/.test(clientMobile.replace(/\s/g, ""))) {
      toast.error("رقم الجوال غير صحيح — مثال: 0512345678");
      return;
    }
    setLoading(showForm);
    try {
      const { data } = await axios.post(
        `${API}/paylink/initiate`,
        {
          plan_id:       showForm,
          client_name:   clientName.trim(),
          client_mobile: clientMobile.replace(/\s/g, ""),
          origin_url:    window.location.origin,
        },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      // Store transaction_no for verification after redirect
      localStorage.setItem("paylink_txn", data.transaction_no);
      toast.success("جاري التحويل لصفحة الدفع...");
      window.location.href = data.payment_url;
    } catch (err) {
      const msg = err?.response?.data?.detail || "خطأ في بدء عملية الدفع";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const isPremium = currentUser?.subscription_type === "premium";

  return (
    <div className="min-h-screen px-4 py-8" style={DARK_BG}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-secondary/5 blur-3xl rounded-full"/>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        <button onClick={() => navigate("/")} className="text-secondary/50 hover:text-secondary mb-8 flex items-center gap-2 transition-colors text-sm">
          ← رجوع
        </button>

        <div className="text-center mb-10 animate-fade-in-up">
          <h1 className="font-black text-secondary text-4xl md:text-5xl mb-3" style={{ fontFamily: "Cairo, sans-serif", textShadow: "0 0 30px rgba(241,225,148,0.4)" }}>
            اشتراك حُجّة المميز
          </h1>
          <p className="text-secondary/60 text-base">العب بأسئلة لا تتكرر أبداً وتتبع تقدمك</p>
        </div>

        {/* Tier comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 animate-fade-in-up">
          {[
            { label: "ضيف",   features: ["اللعب بدون حساب", "6 فئات ثابتة", "الأسئلة قد تتكرر", "بدون حفظ تقدم"], isFree: true },
            { label: "مجاني", features: ["حساب مجاني", "6 فئات ثابتة", "الأسئلة قد تتكرر", "تتبع عدد المباريات"], isFree: true },
            { label: "مميز",  features: ["جميع الفئات (10 فئات)", "أسئلة لا تتكرر أبداً", "تتبع كامل للتقدم", "دعم أولوي"], isFree: false },
          ].map((tier) => (
            <div key={tier.label} className={`rounded-2xl p-5 border ${!tier.isFree ? "border-secondary/60 bg-primary/80" : "border-secondary/15 bg-primary/30"}`}
              style={!tier.isFree ? { boxShadow: "0 0 30px rgba(241,225,148,0.15)" } : {}}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-secondary font-black text-xl">{tier.label}</span>
                {!tier.isFree && <span className="text-[10px] bg-secondary text-primary px-2 py-0.5 rounded-full font-black">مميز</span>}
              </div>
              <ul className="space-y-2">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={tier.isFree ? "text-secondary/30" : "text-secondary"}>{tier.isFree ? "○" : "✓"}</span>
                    <span className={tier.isFree ? "text-secondary/50" : "text-secondary/90"}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Pricing cards */}
        {isPremium ? (
          <div className="text-center bg-primary/60 border border-secondary/40 rounded-2xl p-8">
            <div className="text-5xl mb-3">✓</div>
            <h2 className="text-secondary font-black text-2xl mb-2">أنت مشترك مميز!</h2>
            <p className="text-secondary/60 text-sm mb-4">
              ينتهي اشتراكك: {currentUser?.subscription_expires_at ? new Date(currentUser.subscription_expires_at).toLocaleDateString("ar-SA") : "—"}
            </p>
            <button onClick={() => navigate("/")} className="bg-secondary text-primary font-black px-8 py-3 rounded-full hover:scale-105 transition-all">
              العب الحين
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
              {PLANS.map((plan) => (
                <div key={plan.id} className="relative bg-primary/70 border border-secondary/30 rounded-2xl p-6 hover:border-secondary/60 transition-all duration-300"
                  style={{ boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
                  {plan.badge && (
                    <span className="absolute -top-3 right-4 bg-secondary text-primary text-xs font-black px-3 py-1 rounded-full">{plan.badge}</span>
                  )}
                  <h3 className="text-secondary font-black text-xl mb-1">{plan.name}</h3>
                  <div className="flex items-end gap-1 mb-4">
                    <span className="text-secondary text-3xl font-black">{plan.price} ريال</span>
                    <span className="text-secondary/50 text-sm mb-1">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-secondary/80">
                        <span className="text-secondary">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    data-testid={`upgrade-${plan.id}-btn`}
                    onClick={() => openForm(plan.id)}
                    className="w-full bg-secondary text-primary font-black py-3 rounded-full hover:scale-105 transition-all"
                    style={{ boxShadow: "0 0 20px rgba(241,225,148,0.2)" }}
                  >
                    اشترك الحين
                  </button>
                </div>
              ))}
            </div>

            {/* Payment form modal */}
            {showForm && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-[#1a0205] border border-secondary/30 rounded-2xl p-6 max-w-sm w-full animate-scale-in">
                  <h3 className="text-secondary font-black text-xl mb-1">
                    {PLANS.find(p => p.id === showForm)?.name}
                  </h3>
                  <p className="text-secondary/50 text-sm mb-5">أدخل بياناتك للمتابعة</p>
                  <div className="space-y-4 mb-5">
                    <div>
                      <label className="text-secondary/70 text-sm font-bold block mb-1">الاسم الكامل</label>
                      <input
                        data-testid="paylink-name-input"
                        type="text"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="محمد العمري"
                        className="w-full bg-secondary/5 border border-secondary/20 focus:border-secondary/60 rounded-xl px-4 py-3 text-secondary font-bold outline-none"
                        style={{ fontFamily: "Cairo, sans-serif" }}
                      />
                    </div>
                    <div>
                      <label className="text-secondary/70 text-sm font-bold block mb-1">رقم الجوال</label>
                      <input
                        data-testid="paylink-mobile-input"
                        type="tel"
                        value={clientMobile}
                        onChange={e => setClientMobile(e.target.value)}
                        placeholder="0512345678"
                        className="w-full bg-secondary/5 border border-secondary/20 focus:border-secondary/60 rounded-xl px-4 py-3 text-secondary font-bold outline-none"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowForm(null)} className="flex-1 border border-secondary/20 text-secondary/60 py-3 rounded-xl font-bold hover:border-secondary/40 transition-all">
                      إلغاء
                    </button>
                    <button
                      data-testid="paylink-pay-btn"
                      onClick={handleUpgrade}
                      disabled={loading === showForm}
                      className="flex-1 bg-secondary text-primary font-black py-3 rounded-xl hover:scale-105 transition-all disabled:opacity-50"
                    >
                      {loading === showForm ? "⏳ جاري التحويل..." : "الدفع عبر Paylink"}
                    </button>
                  </div>
                  <p className="text-secondary/30 text-xs text-center mt-3">
                    سيتم تحويلك لصفحة دفع Paylink الآمنة
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        <p className="text-center text-secondary/30 text-xs mt-8">
          الدفع آمن ومشفّر عبر Paylink السعودية
        </p>
      </div>
    </div>
  );
}
