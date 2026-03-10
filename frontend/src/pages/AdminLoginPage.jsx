import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) { toast.error("أدخل كلمة المرور"); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, { password });
      localStorage.setItem("admin_token", data.token);
      toast.success("تم الدخول بنجاح!");
      navigate("/admin/dashboard");
    } catch (e) {
      toast.error("كلمة المرور غلط!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={DARK_BG}>
      <div className="w-full max-w-sm animate-scale-in">
        <button
          onClick={() => navigate("/")}
          className="text-secondary/50 hover:text-secondary mb-6 flex items-center gap-2 transition-colors"
        >
          ← رجوع
        </button>

        <div className="bg-primary/70 border border-secondary/30 rounded-3xl p-8 backdrop-blur-sm text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl font-black text-secondary mb-2">لوحة الإدارة</h1>
          <p className="text-secondary/60 text-sm mb-8">أدخل كلمة المرور للدخول</p>

          <input
            data-testid="admin-password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            className="w-full bg-primary-dark/50 border-2 border-secondary/30 focus:border-secondary text-secondary placeholder:text-secondary/30 px-4 py-3 rounded-xl text-lg font-bold outline-none transition-all text-center mb-4"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />

          <button
            data-testid="admin-login-btn"
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-secondary text-primary font-black text-lg py-3 rounded-full hover:scale-105 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </div>
      </div>
    </div>
  );
}
