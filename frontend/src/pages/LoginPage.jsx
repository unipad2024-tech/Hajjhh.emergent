import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginUser } = useGame();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) {
      toast.error("أكمل جميع الحقول");
      return;
    }
    setLoading(true);
    try {
      await loginUser(form.email, form.password);
      toast.success("أهلاً بعودتك!");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "البريد أو كلمة المرور غلط");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={DARK_BG}>
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-secondary/5 blur-3xl rounded-full"/>
      </div>

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        <button
          onClick={() => navigate("/")}
          className="text-secondary/50 hover:text-secondary mb-6 flex items-center gap-2 transition-colors text-sm"
        >
          → العب كضيف بدون حساب
        </button>

        <div className="bg-primary/60 border border-secondary/25 rounded-3xl p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1
              className="font-black text-secondary text-5xl mb-2"
              style={{ fontFamily: "Cairo, sans-serif", textShadow: "0 0 30px rgba(241,225,148,0.4)" }}
            >
              حُجّة
            </h1>
            <p className="text-secondary/60 text-sm">سجّل دخولك وانطلق</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-secondary/70 text-xs font-bold block mb-1">البريد الإلكتروني</label>
              <input
                data-testid="login-email-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@email.com"
                className="w-full bg-black/30 border-2 border-secondary/20 focus:border-secondary text-secondary placeholder:text-secondary/25 px-4 py-3 rounded-xl outline-none transition-all text-right"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-secondary/70 text-xs font-bold block mb-1">كلمة المرور</label>
              <input
                data-testid="login-password-input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full bg-black/30 border-2 border-secondary/20 focus:border-secondary text-secondary placeholder:text-secondary/25 px-4 py-3 rounded-xl outline-none transition-all text-right"
              />
            </div>

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-primary font-black py-3 rounded-full hover:scale-105 transition-all duration-300 disabled:opacity-50 mt-2 text-lg"
              style={{ boxShadow: "0 0 25px rgba(241,225,148,0.25)" }}
            >
              {loading ? "جاري الدخول..." : "دخول"}
            </button>
          </form>

          <div className="text-center mt-6 text-secondary/50 text-sm">
            ما عندك حساب؟{" "}
            <Link
              data-testid="signup-link"
              to="/signup"
              className="text-secondary hover:text-secondary/80 font-bold underline"
            >
              سجّل الحين
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
