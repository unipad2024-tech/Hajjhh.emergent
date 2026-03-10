import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useGame } from "@/context/GameContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userToken, refreshUser } = useGame();
  const [status, setStatus] = useState("checking"); // checking | success | pending | error

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || !userToken) {
      setStatus("error");
      return;
    }
    const checkStatus = async () => {
      try {
        const { data } = await axios.get(`${API}/subscription/status/${sessionId}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        if (data.payment_status === "paid") {
          await refreshUser();
          setStatus("success");
        } else {
          setStatus("pending");
        }
      } catch {
        setStatus("error");
      }
    };
    checkStatus();
  }, []);

  const messages = {
    checking: { icon: "⏳", title: "جاري التحقق من الدفع...", sub: "لحظة واحدة" },
    success:  { icon: "✓",  title: "تم الاشتراك بنجاح!", sub: "مرحباً بك في حُجّة المميز!" },
    pending:  { icon: "⏳", title: "الدفع قيد المعالجة", sub: "سيتم تفعيل حسابك خلال دقائق" },
    error:    { icon: "✕",  title: "حدث خطأ", sub: "تواصل مع الدعم إذا تم خصم المبلغ" },
  };

  const m = messages[status];

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={DARK_BG}>
      <div className="relative z-10 text-center animate-scale-in max-w-sm w-full">
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 border-2 ${
            status === "success" ? "border-green-400 bg-green-900/30 text-green-400" :
            status === "error"   ? "border-red-400 bg-red-900/30 text-red-400" :
            "border-secondary/40 bg-primary/50 text-secondary"
          }`}
        >
          {m.icon}
        </div>

        <h1
          className="font-black text-secondary text-3xl mb-2"
          style={{ fontFamily: "Cairo, sans-serif" }}
        >
          {m.title}
        </h1>
        <p className="text-secondary/60 text-base mb-8">{m.sub}</p>

        {(status === "success" || status === "pending") && (
          <button
            data-testid="payment-play-btn"
            onClick={() => navigate("/")}
            className="bg-secondary text-primary font-black px-10 py-3 rounded-full hover:scale-105 transition-all text-lg"
            style={{ boxShadow: "0 0 25px rgba(241,225,148,0.3)" }}
          >
            العب الحين
          </button>
        )}

        {status === "error" && (
          <button
            onClick={() => navigate("/pricing")}
            className="bg-primary/60 border border-secondary/30 text-secondary font-bold px-8 py-3 rounded-full hover:border-secondary/60 transition-all"
          >
            رجوع لصفحة الأسعار
          </button>
        )}
      </div>
    </div>
  );
}
