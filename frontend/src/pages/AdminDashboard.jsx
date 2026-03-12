import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_ICONS = {
  cat_flags: "🏳️", cat_easy: "💡", cat_saudi: "🇸🇦",
  cat_islamic: "☪️", cat_science: "🔬", cat_logos: "🏷️", cat_word: "🤫",
  cat_culture: "🎬", cat_sports: "⚽", cat_music: "🎵",
};

const emptyQuestion = {
  category_id: "", difficulty: 300, text: "", answer: "",
  image_url: "", answer_image_url: "", question_type: "text",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("questions");
  const [gameSettings, setGameSettings] = useState({ default_timer: 65, word_timers: { "300": 80, "600": 60, "900": 45 } });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // New category form
  const [catForm, setCatForm] = useState({ name: "", icon: "", description: "", is_special: false, color: "#5B0E14", image_url: "" });
  const [showCatForm, setShowCatForm] = useState(false);

  useEffect(() => {
    if (!token) { navigate("/admin"); return; }
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      await axios.get(`${API}/admin/verify`, { headers });
      loadData();
    } catch {
      localStorage.removeItem("admin_token");
      navigate("/admin");
    }
  };

  const loadData = useCallback(async () => {
    const [catsRes, qsRes] = await Promise.all([
      axios.get(`${API}/categories`),
      axios.get(`${API}/questions`),
    ]);
    setCategories(catsRes.data);
    setQuestions(qsRes.data);
    if (!selectedCat && catsRes.data.length > 0) setSelectedCat(catsRes.data[0].id);
  }, [selectedCat]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/users`, { headers });
      setUsers(data);
    } catch { toast.error("خطأ في تحميل المستخدمين"); }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/analytics`, { headers });
      setAnalytics(data);
    } catch { toast.error("خطأ في تحميل الإحصاءات"); }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/settings`);
      setGameSettings(data);
    } catch {}
  }, []);

  const saveSettings = async () => {
    try {
      await axios.put(`${API}/settings`, gameSettings, { headers });
      toast.success("تم حفظ الإعدادات!");
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch { toast.error("خطأ في الحفظ"); }
  };

  // ── Image upload helper ──
  const uploadImage = async (file, onSuccess) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await axios.post(`${API}/upload`, fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      onSuccess(data.url);
      toast.success("تم رفع الصورة!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "خطأ في رفع الصورة");
    }
  };

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    if (activeTab === "analytics") loadAnalytics();
    if (activeTab === "settings") loadSettings();
  }, [activeTab]);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/seed?force=true`, {}, { headers });
      toast.success(data.message);
      loadData();
    } catch (e) {
      toast.error("خطأ في إضافة البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!form.text.trim() || !form.answer.trim() || !form.category_id) {
      toast.error("أكمل جميع الحقول المطلوبة");
      return;
    }
    setLoading(true);
    try {
      if (editingQuestion) {
        await axios.put(`${API}/questions/${editingQuestion.id}`, form, { headers });
        toast.success("تم تحديث السؤال");
      } else {
        await axios.post(`${API}/questions`, form, { headers });
        toast.success("تمت إضافة السؤال");
      }
      setShowForm(false);
      setEditingQuestion(null);
      setForm(emptyQuestion);
      const { data } = await axios.get(`${API}/questions`);
      setQuestions(data);
    } catch (e) {
      toast.error("خطأ في الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm("تأكيد الحذف؟")) return;
    await axios.delete(`${API}/questions/${id}`, { headers });
    setQuestions(questions.filter((q) => q.id !== id));
    toast.success("تم الحذف");
  };

  const handleEditQuestion = (q) => {
    setEditingQuestion(q);
    setForm({ ...q });
    setShowForm(true);
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) { toast.error("أدخل اسم الفئة"); return; }
    try {
      await axios.post(`${API}/categories`, catForm, { headers });
      toast.success("تمت إضافة الفئة");
      setShowCatForm(false);
      setCatForm({ name: "", icon: "", description: "", is_special: false, color: "#5B0E14", image_url: "" });
      loadData();
    } catch { toast.error("خطأ"); }
  };

  const handleDeleteCat = async (id) => {
    if (!window.confirm("حذف الفئة وجميع أسئلتها؟")) return;
    await axios.delete(`${API}/categories/${id}`, { headers });
    loadData();
    toast.success("تم الحذف");
  };

  const handleUpdateUserSub = async (userId, subType) => {
    try {
      await axios.put(`${API}/admin/users/${userId}`, { subscription_type: subType }, { headers });
      toast.success("تم تحديث الاشتراك");
      loadUsers();
    } catch { toast.error("خطأ في التحديث"); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("حذف المستخدم نهائياً؟")) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}`, { headers });
      toast.success("تم الحذف");
      loadUsers();
    } catch { toast.error("خطأ في الحذف"); }
  };

  const filteredQuestions = questions.filter((q) => {
    const catMatch = selectedCat ? q.category_id === selectedCat : true;
    const diffMatch = selectedDifficulty === "all" ? true : q.difficulty === parseInt(selectedDifficulty);
    return catMatch && diffMatch;
  });

  const getCatName = (id) => categories.find(c => c.id === id)?.name || id;
  const getQuestionCount = (catId, diff) => questions.filter(q => q.category_id === catId && q.difficulty === diff).length;

  const logout = () => {
    localStorage.removeItem("admin_token");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-primary" dir="rtl">
      {/* Top Bar */}
      <div className="bg-primary text-secondary px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black">حُجّة</span>
          <span className="text-secondary/50">|</span>
          <span className="text-secondary/80 font-bold">لوحة الإدارة</span>
        </div>
        <div className="flex gap-3 items-center">
          {/* Tabs */}
          {["questions", "users", "analytics", "settings"].map((tab) => (
            <button
              key={tab}
              data-testid={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`text-sm px-3 py-1 rounded-lg font-bold transition-all ${activeTab === tab ? "bg-secondary text-primary" : "text-secondary/60 hover:text-secondary"}`}
            >
              {tab === "questions" ? "الأسئلة" : tab === "users" ? "المستخدمون" : tab === "analytics" ? "الإحصاءات" : "الإعدادات"}
            </button>
          ))}
          <span className="text-secondary/20">|</span>
          <button
            data-testid="seed-btn"
            onClick={handleSeed}
            className="bg-secondary/20 border border-secondary/30 text-secondary text-sm px-4 py-2 rounded-lg hover:bg-secondary/30 transition-all"
          >
            إضافة بيانات تجريبية
          </button>
          <button onClick={() => navigate("/")} className="text-secondary/60 text-sm hover:text-secondary">الرئيسية</button>
          <button onClick={logout} className="text-secondary/60 text-sm hover:text-secondary">خروج</button>
        </div>
      </div>

      {/* ── QUESTIONS TAB ── */}
      {activeTab === "questions" && (
        <div className="flex">
          {/* Sidebar - Categories */}
          <div className="w-56 bg-primary/5 border-l border-primary/10 min-h-screen p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-black text-sm text-primary/60 uppercase tracking-widest">الفئات</span>
              <button
                data-testid="add-cat-btn"
                onClick={() => setShowCatForm(true)}
                className="text-primary bg-secondary/80 rounded-lg px-2 py-1 text-xs font-bold hover:bg-secondary transition-all"
              >
                + جديد
              </button>
            </div>
            <div className="space-y-1">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${selectedCat === cat.id ? "bg-primary text-secondary" : "hover:bg-primary/10"}`}
                  onClick={() => setSelectedCat(cat.id)}
                >
                  <div className="flex items-center gap-2">
                    <span>{cat.icon || CATEGORY_ICONS[cat.id] || "🎯"}</span>
                    <span className="text-sm font-bold truncate">{cat.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCat(cat.id); }}
                    className="text-red-400/50 hover:text-red-400 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Stats per category */}
            {selectedCat && (
              <div className="mt-4 bg-primary/5 rounded-xl p-3">
                <div className="text-xs font-bold text-primary/50 mb-2">إحصاء الأسئلة</div>
                {[300, 600, 900].map(d => (
                  <div key={d} className="flex justify-between items-center text-xs py-1">
                    <span className="text-primary/60">{d} نقطة</span>
                    <span className={`font-black ${getQuestionCount(selectedCat, d) >= 10 ? "text-green-600" : "text-amber-600"}`}>
                      {getQuestionCount(selectedCat, d)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black">
                  {selectedCat ? getCatName(selectedCat) : "كل الأسئلة"}
                </h2>
                <div className="flex gap-2">
                  {["all", "300", "600", "900"].map((d) => (
                    <button
                      key={d}
                      data-testid={`filter-${d}`}
                      onClick={() => setSelectedDifficulty(d)}
                      className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${selectedDifficulty === d ? "bg-primary text-secondary" : "bg-primary/10 hover:bg-primary/20"}`}
                    >
                      {d === "all" ? "الكل" : d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-primary/40 text-sm">{filteredQuestions.length} سؤال</span>
                <button
                  data-testid="add-question-btn"
                  onClick={() => {
                    setEditingQuestion(null);
                    setForm({ ...emptyQuestion, category_id: selectedCat || "" });
                    setShowForm(true);
                  }}
                  className="bg-primary text-secondary px-5 py-2 rounded-full font-bold hover:scale-105 transition-all"
                >
                  + سؤال جديد
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-16 text-primary/30">
                  <div className="text-5xl mb-3">📝</div>
                  <div className="text-xl font-bold">لا يوجد أسئلة</div>
                  <div className="text-sm mt-2">اضغط "+ سؤال جديد" لإضافة أسئلة</div>
                </div>
              ) : (
                filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    data-testid={`question-row-${q.id}`}
                    className="bg-white border border-primary/10 rounded-xl p-4 flex items-start gap-3 hover:border-primary/30 transition-all"
                  >
                    {q.image_url && (
                      <img src={q.image_url} alt="" className="w-12 h-10 object-cover rounded-lg border border-primary/10 flex-shrink-0" onError={(e) => e.target.style.display = "none"} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${q.difficulty === 300 ? "bg-green-100 text-green-700" : q.difficulty === 600 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {q.difficulty}
                        </span>
                        <span className="text-xs text-primary/50">{getCatName(q.category_id)}</span>
                        {q.question_type === "secret_word" && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">ولا كلمة</span>
                        )}
                      </div>
                      <div className="font-bold text-primary truncate">{q.text}</div>
                      <div className="text-primary/60 text-sm mt-1">
                        الإجابة: <span className="font-medium text-primary">{q.answer}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        data-testid={`edit-q-${q.id}`}
                        onClick={() => handleEditQuestion(q)}
                        className="text-primary/50 hover:text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1 rounded-lg text-sm font-bold transition-all"
                      >
                        تعديل
                      </button>
                      <button
                        data-testid={`delete-q-${q.id}`}
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-red-400/60 hover:text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg text-sm font-bold transition-all"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <div className="p-6">
          <h2 className="text-2xl font-black mb-6">المستخدمون ({users.length})</h2>
          {users.length === 0 ? (
            <div className="text-center py-16 text-primary/30">
              <div className="text-5xl mb-3">👤</div>
              <div className="text-xl font-bold">لا يوجد مستخدمون</div>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} data-testid={`user-row-${user.id}`} className="bg-white border border-primary/10 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-primary">{user.username}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${user.subscription_type === "premium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                        {user.subscription_type === "premium" ? "مميز" : "مجاني"}
                      </span>
                    </div>
                    <div className="text-primary/50 text-xs">{user.email}</div>
                    <div className="text-primary/40 text-xs mt-0.5">
                      مباريات: {user.game_count || 0} · أسئلة مجابة: {user.answered_count || 0}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {user.subscription_type !== "premium" ? (
                      <button
                        data-testid={`make-premium-${user.id}`}
                        onClick={() => handleUpdateUserSub(user.id, "premium")}
                        className="text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                      >
                        ترقية مميز
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateUserSub(user.id, "free")}
                        className="text-gray-500 bg-gray-50 hover:bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                      >
                        إلغاء المميز
                      </button>
                    )}
                    <button
                      data-testid={`delete-user-${user.id}`}
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-400/60 hover:text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === "analytics" && (
        <div className="p-6">
          <h2 className="text-2xl font-black mb-6">الإحصاءات</h2>
          {!analytics ? (
            <div className="text-center py-16 text-primary/30">جاري التحميل...</div>
          ) : (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "المستخدمون", value: analytics.users.total, sub: `${analytics.users.premium} مميز`, color: "bg-blue-50 border-blue-200" },
                  { label: "المشتركون المميزون", value: analytics.users.premium, sub: `${analytics.users.free} مجاني`, color: "bg-amber-50 border-amber-200" },
                  { label: "الأسئلة", value: analytics.questions.total, sub: "في قاعدة البيانات", color: "bg-green-50 border-green-200" },
                  { label: "المباريات", value: analytics.sessions.total, sub: `${analytics.sessions.active_24h} اليوم`, color: "bg-purple-50 border-purple-200" },
                ].map((kpi) => (
                  <div key={kpi.label} className={`${kpi.color} border rounded-xl p-4`}>
                    <div className="text-3xl font-black text-primary mb-1">{kpi.value}</div>
                    <div className="text-sm font-bold text-primary/70">{kpi.label}</div>
                    <div className="text-xs text-primary/40 mt-1">{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Revenue */}
              <div className="bg-white border border-primary/10 rounded-xl p-5">
                <h3 className="font-black text-lg mb-3">الإيرادات</h3>
                <div className="text-4xl font-black text-primary mb-1">${analytics.revenue.total}</div>
                <div className="text-primary/50 text-sm">إجمالي الإيرادات ({analytics.revenue.currency})</div>
                {analytics.revenue.recent_transactions?.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-bold text-primary/50 uppercase tracking-widest mb-2">آخر المعاملات</div>
                    {analytics.revenue.recent_transactions.map((txn, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-primary/5 text-sm">
                        <span className="text-primary/60">{txn.email}</span>
                        <span className={`font-bold ${txn.payment_status === "paid" ? "text-green-600" : "text-amber-600"}`}>
                          ${txn.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Questions by category */}
              <div className="bg-white border border-primary/10 rounded-xl p-5">
                <h3 className="font-black text-lg mb-3">الأسئلة بالفئات</h3>
                <div className="space-y-2">
                  {analytics.questions.by_category.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3">
                      <span className="text-primary/70 text-sm w-32 truncate">{cat.name}</span>
                      <div className="flex-1 bg-primary/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.min(100, (cat.count / 50) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-primary/60 w-8 text-left">{cat.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Question Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-primary mb-4">
              {editingQuestion ? "تعديل السؤال" : "سؤال جديد"}
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-primary/70 mb-1 block">الفئة</label>
                  <select
                    data-testid="question-category-select"
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none bg-white"
                  >
                    <option value="">اختر فئة</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-primary/70 mb-1 block">الصعوبة</label>
                  <select
                    data-testid="question-difficulty-select"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: parseInt(e.target.value) })}
                    className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none bg-white"
                  >
                    <option value={300}>300 - سهل</option>
                    <option value={600}>600 - متوسط</option>
                    <option value={900}>900 - صعب</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-primary/70 mb-1 block">نوع السؤال</label>
                <select
                  data-testid="question-type-select"
                  value={form.question_type}
                  onChange={(e) => setForm({ ...form, question_type: e.target.value })}
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none bg-white"
                >
                  <option value="text">سؤال عادي</option>
                  <option value="secret_word">ولا كلمة (كلمة سرية)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-primary/70 mb-1 block">
                  {form.question_type === "secret_word" ? "تعليمات" : "نص السؤال"}
                </label>
                <textarea
                  data-testid="question-text-input"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  placeholder={form.question_type === "secret_word" ? "وصّف هذي الكلمة لفريقك!" : "أدخل نص السؤال"}
                  rows={3}
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-primary/70 mb-1 block">
                  {form.question_type === "secret_word" ? "الكلمة السرية" : "الإجابة"}
                </label>
                <input
                  data-testid="question-answer-input"
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  placeholder={form.question_type === "secret_word" ? "الكلمة السرية" : "الإجابة الصحيحة"}
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-primary/70 mb-1 block">رابط صورة السؤال (اختياري)</label>
                <input
                  data-testid="question-image-input"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
                />
                {form.image_url && (
                  <img src={form.image_url} alt="" className="mt-2 h-16 object-contain rounded-lg" onError={(e) => e.target.style.display = "none"} />
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-primary/70 mb-1 block">رابط صورة الإجابة (اختياري)</label>
                <input
                  data-testid="question-answer-image-input"
                  value={form.answer_image_url}
                  onChange={(e) => setForm({ ...form, answer_image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                data-testid="save-question-btn"
                onClick={handleSaveQuestion}
                disabled={loading}
                className="flex-1 bg-primary text-secondary py-3 rounded-xl font-bold hover:scale-105 transition-all disabled:opacity-50"
              >
                {loading ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button
                data-testid="cancel-question-btn"
                onClick={() => { setShowForm(false); setEditingQuestion(null); }}
                className="flex-1 bg-primary/10 text-primary py-3 rounded-xl font-bold hover:bg-primary/20 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCatForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-black text-primary mb-4">فئة جديدة</h3>
            <div className="space-y-3">
              <input
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                placeholder="اسم الفئة"
                className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
              />
              <input
                value={catForm.icon}
                onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                placeholder="إيموجي (مثل: 🎯)"
                className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
              />
              <input
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                placeholder="وصف الفئة (اختياري)"
                className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
              />
              <div>
                <label className="text-sm font-bold text-primary/70 mb-1 block">رابط صورة الفئة</label>
                <input
                  value={catForm.image_url}
                  onChange={(e) => setCatForm({ ...catForm, image_url: e.target.value })}
                  placeholder="https://... (رابط الصورة)"
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
                />
                {catForm.image_url && (
                  <img src={catForm.image_url} alt="" className="mt-2 h-20 w-full object-cover rounded-xl" onError={(e) => e.target.style.display = "none"} />
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catForm.is_special}
                  onChange={(e) => setCatForm({ ...catForm, is_special: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-bold text-primary/70">فئة خاصة (مثل ولا كلمة)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSaveCat} className="flex-1 bg-primary text-secondary py-2 rounded-xl font-bold">حفظ</button>
              <button onClick={() => setShowCatForm(false)} className="flex-1 bg-primary/10 text-primary py-2 rounded-xl font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
