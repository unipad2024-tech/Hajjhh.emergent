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
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    // Get transaction_no from URL param or localStorage
    const txnFromUrl    = searchParams.get("txn") || searchParams.get("transactionNo") || searchParams.get("transaction_no");
    const txnFromStore  = localStorage.getItem("paylink_txn");
    const transactionNo = txnFromUrl || txnFromStore;

    if (!transactionNo) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        if (userToken) {
          // Authenticated: call verify endpoint (activates subscription if paid)
          const { data } = await axios.get(`${API}/paylink/verify/${transactionNo}`, {
            headers: { Authorization: `Bearer ${userToken}` },
          });
          if (data.order_status === "Paid") {
            localStorage.removeItem("paylink_txn");
            if (refreshUser) await refreshUser();
            setStatus("success");
          } else {
            setStatus("pending");
          }
        } else {
          // Not logged in: public check only
          const { data } = await axios.get(`${API}/paylink/status/${transactionNo}`);
          setStatus(data.order_status === "Paid" ? "success" : "pending");
        }
      } catch {
        setStatus("error");
      }
    };

    verify();
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
      <div className="relative z-10 text-center max-w-sm w-full">
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 border-2 ${
            status === "success" ? "border-green-400 bg-green-900/30 text-green-400" :
            status === "error"   ? "border-red-400 bg-red-900/30 text-red-400" :
            "border-secondary/40 bg-primary/50 text-secondary"
          }`}
        >
          {m.icon}
        </div>
        <h1 className="text-secondary font-black text-2xl mb-2">{m.title}</h1>
        <p className="text-secondary/60 text-sm mb-8">{m.sub}</p>

        {status === "success" && (
          <button
            data-testid="go-home-btn"
            onClick={() => navigate("/")}
            className="bg-secondary text-primary font-black px-10 py-3 rounded-full hover:scale-105 transition-all"
          >
            العب الحين
          </button>
        )}
        {status === "pending" && (
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="bg-secondary text-primary font-black px-8 py-3 rounded-full hover:scale-105 transition-all block w-full"
            >
              التحقق مجدداً
            </button>
            <button onClick={() => navigate("/")} className="text-secondary/40 text-sm hover:text-secondary transition-colors">
              العودة للرئيسية
            </button>
          </div>
        )}
        {status === "error" && (
          <button onClick={() => navigate("/pricing")} className="text-secondary/60 hover:text-secondary text-sm transition-colors">
            العودة للاشتراك
          </button>
        )}
      </div>
    </div>
  );
}
