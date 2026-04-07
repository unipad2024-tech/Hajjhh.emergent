import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";
import { Eye, EyeOff } from "lucide-react";

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

// Defined OUTSIDE component to prevent re-mount on every render (focus loss bug)
function PwInput({ testId, toggleId, value, onChange, placeholder, show, onToggle }) {
  return (
    <div className="relative">
      <input
        data-testid={testId}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full bg-black/30 border-2 border-secondary/20 focus:border-secondary text-secondary placeholder:text-secondary/25 px-4 py-3 pr-12 rounded-xl outline-none transition-colors"
      />
      <button
        type="button"
        data-testid={toggleId}
        onClick={onToggle}
        tabIndex={-1}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/40 hover:text-secondary/80 transition-colors"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { registerUser } = useGame();
  const [form, setForm] = useState({ email: "", username: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error("أكمل جميع الحقول"); return;
    }
    if (form.password.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    if (form.password !== form.confirm) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    setLoading(true);
    try {
      await registerUser(form.email, form.username, form.password);
      toast.success("مرحباً! تم إنشاء حسابك");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "خطأ في إنشاء الحساب");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={DARK_BG}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-secondary/5 blur-3xl rounded-full"/>
      </div>

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        <button onClick={() => navigate("/")} className="text-secondary/50 hover:text-secondary mb-6 flex items-center gap-2 transition-colors text-sm">
          → العب كضيف بدون حساب
        </button>

        <div className="bg-primary/60 border border-secondary/25 rounded-3xl p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="font-black text-secondary text-5xl mb-2" style={{ fontFamily: "Cairo, sans-serif", textShadow: "0 0 30px rgba(241,225,148,0.4)" }}>
              حُجّة
            </h1>
            <p className="text-secondary/60 text-sm">أنشئ حسابك وانضم</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="text-secondary/70 text-xs font-bold block mb-1">البريد الإلكتروني</label>
              <input
                data-testid="signup-email-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="example@email.com"
                dir="ltr"
                autoComplete="email"
                className="w-full bg-black/30 border-2 border-secondary/20 focus:border-secondary text-secondary placeholder:text-secondary/25 px-4 py-3 rounded-xl outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-secondary/70 text-xs font-bold block mb-1">اسم المستخدم</label>
              <input
                data-testid="signup-username-input"
                type="text"
                value={form.username}
                onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="اسمك في اللعبة"
                autoComplete="username"
                className="w-full bg-black/30 border-2 border-secondary/20 focus:border-secondary text-secondary placeholder:text-secondary/25 px-4 py-3 rounded-xl outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-secondary/70 text-xs font-bold block mb-1">كلمة المرور</label>
              <PwInput
                testId="signup-password-input"
                toggleId="signup-pw-toggle"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="6 أحرف على الأقل"
                show={showPw}
                onToggle={() => setShowPw(v => !v)}
              />
            </div>
            <div>
              <label className="text-secondary/70 text-xs font-bold block mb-1">تأكيد كلمة المرور</label>
              <PwInput
                testId="signup-confirm-input"
                toggleId="signup-confirm-toggle"
                value={form.confirm}
                onChange={(e) => setForm(prev => ({ ...prev, confirm: e.target.value }))}
                placeholder="أعد كتابة كلمة المرور"
                show={showConfirm}
                onToggle={() => setShowConfirm(v => !v)}
              />
            </div>

            <button
              data-testid="signup-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-primary font-black py-3 rounded-full hover:scale-105 transition-all duration-300 disabled:opacity-50 mt-2 text-lg"
              style={{ boxShadow: "0 0 25px rgba(241,225,148,0.25)" }}
            >
              {loading ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </button>
          </form>

          <div className="text-center mt-6 text-secondary/50 text-sm">
            عندك حساب؟{" "}
            <Link data-testid="login-link" to="/login" className="text-secondary hover:text-secondary/80 font-bold underline">
              سجّل دخولك
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
