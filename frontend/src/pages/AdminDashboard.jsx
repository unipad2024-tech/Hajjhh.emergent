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

  // Role-based access
  const [adminRole, setAdminRole] = useState(localStorage.getItem("admin_role") || "super_admin");
  const [adminName, setAdminName] = useState(localStorage.getItem("admin_name") || "المدير الرئيسي");
  const isSuperAdmin = adminRole === "super_admin";

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
  const [gameSettings, setGameSettings] = useState({ default_timer: 65, word_timers: { "300": 80, "600": 60, "900": 45 }, free_categories: [], trial_enabled: true, trial_team1_categories: [], trial_team2_categories: [], trial_questions_only: false });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Admin logs state
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);

  // Staff management state
  const [staffList, setStaffList] = useState([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ username: "", password: "", display_name: "" });
  const [editingStaff, setEditingStaff] = useState(null);

  // Experimental mode
  const [expQuestions, setExpQuestions] = useState([]);
  const [expCatFilter, setExpCatFilter] = useState("all");
  const [expDiffFilter, setExpDiffFilter] = useState("all");
  const [expLoading, setExpLoading] = useState(false);
  const [expEditQ, setExpEditQ] = useState(null);
  const [expForm, setExpForm] = useState({ text: "", answer: "", difficulty: 300, image_url: "", answer_image_url: "" });

  // AI Generator state
  const [aiCatId, setAiCatId] = useState("");
  const [aiDiff, setAiDiff] = useState(300);
  const [aiCount, setAiCount] = useState(10);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [aiSaving, setAiSaving] = useState(false);

  // New category form
  const [catForm, setCatForm] = useState({ name: "", icon: "", description: "", is_special: false, is_premium: false, is_active: true, color: "#5B0E14", image_url: "" });
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);

  useEffect(() => {
    if (!token) { navigate("/admin"); return; }
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/verify`, { headers });
      // Refresh role from server response
      const role = data.role || "super_admin";
      const name = data.name || "المدير الرئيسي";
      setAdminRole(role);
      setAdminName(name);
      localStorage.setItem("admin_role", role);
      localStorage.setItem("admin_name", name);
      loadData();
    } catch {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_role");
      localStorage.removeItem("admin_name");
      navigate("/admin");
    }
  };

  const loadData = useCallback(async () => {
    const [catsRes, qsRes] = await Promise.all([
      axios.get(`${API}/categories?show_inactive=true`),
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

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/logs?limit=100`, { headers });
      setLogs(data.logs || []);
      setLogsTotal(data.total || 0);
    } catch { toast.error("خطأ في تحميل سجل النشاط"); }
    finally { setLogsLoading(false); }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/staff`, { headers });
      setStaffList(data);
    } catch { toast.error("خطأ في تحميل قائمة الموظفين"); }
  }, []);

  const saveSettings = async () => {
    try {
      const body = {
        default_timer: gameSettings.default_timer,
        word_timers: gameSettings.word_timers,
        free_categories: gameSettings.free_categories || [],
        trial_enabled: gameSettings.trial_enabled ?? true,
        trial_team1_categories: gameSettings.trial_team1_categories || [],
        trial_team2_categories: gameSettings.trial_team2_categories || [],
        trial_questions_only: gameSettings.trial_questions_only ?? false,
      };
      await axios.put(`${API}/settings`, body, { headers });
      toast.success("تم حفظ الإعدادات ✓");
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
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
    if (activeTab === "logs") loadLogs();
    if (activeTab === "staff") loadStaff();
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
      if (editingCat) {
        await axios.put(`${API}/categories/${editingCat.id}`, catForm, { headers });
        toast.success("تم تحديث الفئة");
      } else {
        await axios.post(`${API}/categories`, catForm, { headers });
        toast.success("تمت إضافة الفئة");
      }
      setShowCatForm(false);
      setEditingCat(null);
      setCatForm({ name: "", icon: "", description: "", is_special: false, is_premium: false, is_active: true, color: "#5B0E14", image_url: "" });
      loadData();
    } catch { toast.error("خطأ"); }
  };

  const handleEditCat = (cat) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, icon: cat.icon || "", description: cat.description || "", is_special: cat.is_special || false, is_premium: cat.is_premium || false, is_active: cat.is_active !== false, color: cat.color || "#5B0E14", image_url: cat.image_url || "" });
    setShowCatForm(true);
  };

  const handleDeleteCat = async (id) => {
    if (!window.confirm("حذف الفئة وجميع أسئلتها؟")) return;
    await axios.delete(`${API}/categories/${id}`, { headers });
    loadData();
    toast.success("تم الحذف");
  };

  // ── Experimental Mode Handlers ──
  const loadExpQuestions = async () => {
    setExpLoading(true);
    try {
      const { data } = await axios.get(`${API}/questions`, { params: { ...(expCatFilter !== "all" && { category_id: expCatFilter }) } });
      setExpQuestions(data);
    } catch { toast.error("خطأ في تحميل الأسئلة"); }
    finally { setExpLoading(false); }
  };

  const handleToggleExp = async (q) => {
    try {
      await axios.patch(`${API}/questions/${q.id}/experimental`, { is_experimental: !q.is_experimental }, { headers });
      setExpQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_experimental: !x.is_experimental } : x));
      toast.success((!q.is_experimental) ? "مُضاف لوضع التجربة ✓" : "مُزال من وضع التجربة");
    } catch { toast.error("خطأ"); }
  };

  const handleDeleteExpQ = async (qId) => {
    if (!window.confirm("هل تريد حذف هذا السؤال؟")) return;
    try {
      await axios.delete(`${API}/questions/${qId}`, { headers });
      setExpQuestions(prev => prev.filter(x => x.id !== qId));
      toast.success("تم الحذف");
    } catch { toast.error("خطأ في الحذف"); }
  };

  const handleSaveExpQ = async () => {
    if (!expForm.text.trim() || !expForm.answer.trim()) { toast.error("أدخل السؤال والإجابة"); return; }
    try {
      if (expEditQ) {
        await axios.put(`${API}/questions/${expEditQ.id}`, { ...expForm, is_experimental: true, category_id: expEditQ.category_id }, { headers });
        setExpQuestions(prev => prev.map(x => x.id === expEditQ.id ? { ...x, ...expForm, is_experimental: true } : x));
        toast.success("تم التحديث");
      }
      setExpEditQ(null);
      setExpForm({ text: "", answer: "", difficulty: 300, image_url: "", answer_image_url: "" });
    } catch { toast.error("خطأ في الحفظ"); }
  };

  const handleAiGenerate = async () => {
    if (!aiCatId) { toast.error("اختر الفئة أولاً"); return; }
    setAiGenerating(true);
    setAiQuestions([]);
    try {
      const { data } = await axios.post(`${API}/ai/generate-questions`, {
        category_id: aiCatId,
        difficulty: aiDiff,
        count: aiCount,
        prompt_description: aiPrompt.trim() || undefined,
      }, { headers });
      setAiQuestions(data.questions);
      toast.success(`تم توليد ${data.count} سؤال!`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "خطأ في التوليد");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiSave = async () => {
    if (!aiQuestions.length) return;
    setAiSaving(true);
    try {
      const { data } = await axios.post(`${API}/ai/save-questions`, { questions: aiQuestions }, { headers });
      toast.success(data.message);
      setAiQuestions([]);
      const { data: qs } = await axios.get(`${API}/questions`);
      setQuestions(qs);
    } catch { toast.error("خطأ في الحفظ"); }
    finally { setAiSaving(false); }
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

  const handleGiftSubscription = async (userId, planId = "monthly") => {
    try {
      await axios.post(`${API}/admin/users/${userId}/gift-subscription`,
        { plan_id: planId }, { headers });
      toast.success("تم منح الاشتراك المميز مجاناً");
      loadUsers();
    } catch { toast.error("خطأ في منح الاشتراك"); }
  };

  const handleSaveStaff = async () => {
    if (!staffForm.username.trim() || !staffForm.password.trim()) {
      toast.error("اسم المستخدم وكلمة المرور مطلوبان"); return;
    }
    try {
      if (editingStaff) {
        await axios.put(`${API}/admin/staff/${editingStaff.id}`,
          { display_name: staffForm.display_name, password: staffForm.password || undefined }, { headers });
        toast.success("تم تحديث الموظف");
      } else {
        await axios.post(`${API}/admin/staff`, staffForm, { headers });
        toast.success("تم إضافة الموظف");
      }
      setShowStaffForm(false);
      setEditingStaff(null);
      setStaffForm({ username: "", password: "", display_name: "" });
      loadStaff();
    } catch (e) { toast.error(e?.response?.data?.detail || "خطأ في الحفظ"); }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm("حذف الموظف نهائياً؟")) return;
    try {
      await axios.delete(`${API}/admin/staff/${staffId}`, { headers });
      toast.success("تم الحذف");
      loadStaff();
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
    localStorage.removeItem("admin_role");
    localStorage.removeItem("admin_name");
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
          {/* Role badge */}
          <span
            data-testid="admin-role-badge"
            className={`text-xs px-2 py-0.5 rounded-full font-black border ${
              isSuperAdmin
                ? "bg-amber-400/20 border-amber-400/40 text-amber-300"
                : "bg-blue-400/20 border-blue-400/40 text-blue-300"
            }`}
          >
            {isSuperAdmin ? "مدير رئيسي" : "موظف"}
          </span>
          <span className="text-secondary/40 text-xs">{adminName}</span>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Tabs - filtered by role */}
          {[
            { key: "questions", label: "الأسئلة", forAll: true },
            { key: "users", label: "المستخدمون", superOnly: true },
            { key: "analytics", label: "الإحصاءات", superOnly: true },
            { key: "settings", label: "الإعدادات", superOnly: true },
            { key: "ai", label: "توليد AI", forAll: true },
            { key: "experimental", label: "وضع التجربة", forAll: true },
            { key: "logs", label: "سجل النشاط", superOnly: true },
            { key: "staff", label: "الموظفون", superOnly: true },
          ]
            .filter(t => t.forAll || (t.superOnly && isSuperAdmin))
            .map((tab) => (
              <button
                key={tab.key}
                data-testid={`tab-${tab.key}`}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === "experimental") { loadSettings(); loadExpQuestions(); }
                  if (tab.key === "settings") loadSettings();
                }}
                className={`text-sm px-3 py-1 rounded-lg font-bold transition-all ${activeTab === tab.key ? "bg-secondary text-primary" : "text-secondary/60 hover:text-secondary"}`}
              >
                {tab.label}
              </button>
            ))}
          <span className="text-secondary/20">|</span>
          {isSuperAdmin && (
            <button
              data-testid="seed-btn"
              onClick={handleSeed}
              className="bg-secondary/20 border border-secondary/30 text-secondary text-sm px-4 py-2 rounded-lg hover:bg-secondary/30 transition-all"
            >
              إضافة بيانات
            </button>
          )}
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
                  style={{ opacity: cat.is_active === false ? 0.45 : 1 }}
                  onClick={() => setSelectedCat(cat.id)}
                >
                  <div className="flex items-center gap-2">
                    <span>{cat.icon || CATEGORY_ICONS[cat.id] || "🎯"}</span>
                    <span className="text-sm font-bold truncate">{cat.name}</span>
                    {cat.is_premium && <span className="text-yellow-500 text-xs">⭐</span>}
                    {cat.is_active === false && <span className="text-red-400 text-xs">●</span>}
                  </div>
                  <button
                    data-testid={`edit-cat-${cat.id}`}
                    onClick={(e) => { e.stopPropagation(); handleEditCat(cat); }}
                    className="text-primary/40 hover:text-primary/70 text-xs px-1"
                    title="تعديل"
                  >
                    ✎
                  </button>
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
                      <>
                        <button
                          data-testid={`make-premium-${user.id}`}
                          onClick={() => handleUpdateUserSub(user.id, "premium")}
                          className="text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                        >
                          ترقية
                        </button>
                        <button
                          data-testid={`gift-sub-${user.id}`}
                          onClick={() => handleGiftSubscription(user.id, "monthly")}
                          className="text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                        >
                          هدية
                        </button>
                      </>
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

              {/* Categories Stats */}
              {analytics.categories && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "إجمالي الفئات", value: analytics.categories.total, color: "bg-teal-50 border-teal-200" },
                    { label: "الفئات النشطة", value: analytics.categories.active, color: "bg-green-50 border-green-200" },
                    { label: "الفئات المعطّلة", value: analytics.categories.inactive, color: "bg-red-50 border-red-200" },
                    { label: "الفئات المميزة", value: analytics.categories.premium, color: "bg-amber-50 border-amber-200" },
                  ].map((kpi) => (
                    <div key={kpi.label} className={`${kpi.color} border rounded-xl p-4`}>
                      <div className="text-3xl font-black text-primary mb-1">{kpi.value}</div>
                      <div className="text-sm font-bold text-primary/70">{kpi.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Most Popular Category */}
              {analytics.categories?.most_popular?.name && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="text-3xl">🏆</div>
                  <div>
                    <div className="text-xs font-bold text-amber-700/60 uppercase tracking-widest">الفئة الأكثر أسئلة</div>
                    <div className="font-black text-xl text-amber-800">{analytics.categories.most_popular.name}</div>
                    <div className="text-amber-700/60 text-sm">{analytics.categories.most_popular.count} سؤال</div>
                  </div>
                </div>
              )}

              {/* Revenue */}
              <div className="bg-white border border-primary/10 rounded-xl p-5">
                <h3 className="font-black text-lg mb-3">الإيرادات</h3>
                <div className="text-4xl font-black text-primary mb-1">{analytics.revenue.total} {analytics.revenue.currency}</div>
                <div className="text-primary/50 text-sm">إجمالي الإيرادات</div>
                {analytics.revenue.recent_transactions?.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-bold text-primary/50 uppercase tracking-widest mb-2">آخر المعاملات</div>
                    {analytics.revenue.recent_transactions.map((txn, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-primary/5 text-sm">
                        <span className="text-primary/60">{txn.email || txn.gifted_by}</span>
                        <span className={`font-bold ${txn.payment_status === "paid" ? "text-green-600" : txn.payment_status === "gift" ? "text-amber-600" : "text-red-500"}`}>
                          {txn.payment_status === "gift" ? "هدية" : `${txn.amount} ${txn.currency || ""}`}
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

      {/* ── SETTINGS TAB ── */}
      {activeTab === "settings" && (
        <div className="p-6 max-w-2xl mx-auto">
          <h2 className="text-2xl font-black mb-6">إعدادات اللعبة</h2>

          {/* Default Timer */}
          <div className="bg-white border border-primary/10 rounded-2xl p-6 mb-4">
            <h3 className="font-black text-lg mb-1">التايمر الافتراضي</h3>
            <p className="text-primary/50 text-sm mb-4">مدة الإجابة الافتراضية لكل الأسئلة (بالثواني)</p>
            <div className="flex items-center gap-4">
              <input
                data-testid="default-timer-input"
                type="number"
                min={10} max={180}
                value={gameSettings.default_timer}
                onChange={(e) => setGameSettings({ ...gameSettings, default_timer: parseInt(e.target.value) || 65 })}
                className="w-28 border-2 border-primary/20 focus:border-primary rounded-xl px-4 py-2 text-xl font-black outline-none text-center"
              />
              <span className="text-primary/50 font-bold">ثانية</span>
              <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/50 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (gameSettings.default_timer / 120) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* ولا كلمة timers */}
          <div className="bg-white border border-primary/10 rounded-2xl p-6 mb-6">
            <h3 className="font-black text-lg mb-1">تايمرات "ولا كلمة"</h3>
            <p className="text-primary/50 text-sm mb-4">مدة مخصصة لفئة ولا كلمة حسب الصعوبة</p>
            <div className="space-y-4">
              {[
                { key: "300", label: "سهل (300 نقطة)", color: "text-green-600", bg: "bg-green-50 border-green-200" },
                { key: "600", label: "متوسط (600 نقطة)", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                { key: "900", label: "صعب (900 نقطة)", color: "text-red-600", bg: "bg-red-50 border-red-200" },
              ].map(({ key, label, color, bg }) => (
                <div key={key} className={`flex items-center gap-4 p-3 rounded-xl border ${bg}`}>
                  <span className={`font-black text-sm w-36 ${color}`}>{label}</span>
                  <input
                    data-testid={`word-timer-${key}`}
                    type="number"
                    min={10} max={180}
                    value={gameSettings.word_timers?.[key] ?? (key === "300" ? 80 : key === "600" ? 60 : 45)}
                    onChange={(e) => setGameSettings({
                      ...gameSettings,
                      word_timers: { ...gameSettings.word_timers, [key]: parseInt(e.target.value) || 60 }
                    })}
                    className="w-20 border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-1.5 text-lg font-black outline-none text-center bg-white"
                  />
                  <span className="text-primary/50 text-sm">ثانية</span>
                </div>
              ))}
            </div>
          </div>

          <button
            data-testid="save-settings-btn"
            onClick={saveSettings}
            className="w-full bg-primary text-secondary py-3 rounded-xl font-black text-lg hover:scale-[1.02] transition-all"
          >
            {settingsSaved ? "✓ تم الحفظ!" : "حفظ الإعدادات"}
          </button>

          {/* Reset hint */}
          <p className="text-center text-primary/30 text-xs mt-3">
            ملاحظة: التايمر الافتراضي 65 ثانية · ولا كلمة: سهل 80s، متوسط 60s، صعب 45s
          </p>

          {/* Trial Mode - Free Categories */}
          <div className="bg-white border border-primary/10 rounded-2xl p-6 mt-6">
            <h3 className="font-black text-lg mb-1">الفئات المجانية (وضع التجربة)</h3>
            <p className="text-primary/50 text-sm mb-4">الفئات المتاحة للمستخدمين المجانيين وغير المشتركين</p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => {
                const isFree = (gameSettings.free_categories || []).includes(cat.id);
                return (
                  <label key={cat.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isFree ? "border-green-400 bg-green-50" : "border-primary/10 hover:border-primary/20"}`}>
                    <input
                      type="checkbox"
                      checked={isFree}
                      onChange={(e) => {
                        const current = gameSettings.free_categories || [];
                        const updated = e.target.checked
                          ? [...current, cat.id]
                          : current.filter(id => id !== cat.id);
                        setGameSettings({ ...gameSettings, free_categories: updated });
                      }}
                      className="w-4 h-4 accent-green-600"
                    />
                    <span className="text-lg">{cat.icon || "🎯"}</span>
                    <span className="text-sm font-bold text-primary">{cat.name}</span>
                    {isFree && <span className="text-xs text-green-600 font-bold mr-auto">مجاني</span>}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-primary/30 mt-3 text-center">
              {(gameSettings.free_categories || []).length} فئة مجانية من أصل {categories.length}
            </p>
          </div>
        </div>
      )}

      {/* ── ACTIVITY LOGS TAB ── */}
      {activeTab === "logs" && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black">سجل النشاط</h2>
              <p className="text-primary/50 text-sm mt-1">جميع الإجراءات التي قام بها المدراء والموظفون</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-primary/40 text-sm">{logsTotal} إجراء</span>
              <button
                data-testid="refresh-logs-btn"
                onClick={loadLogs}
                className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-bold transition-all"
              >
                تحديث
              </button>
            </div>
          </div>
          {logsLoading ? (
            <div className="text-center py-16 text-primary/30">جاري التحميل...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-primary/30">
              <div className="text-5xl mb-3">📋</div>
              <div className="text-xl font-bold">لا يوجد سجل بعد</div>
              <div className="text-sm mt-2">ستظهر هنا إجراءات المدراء والموظفين</div>
            </div>
          ) : (
            <div className="bg-white border border-primary/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-primary/5 border-b border-primary/10">
                  <tr>
                    <th className="text-right p-3 font-black text-primary/60 text-xs uppercase tracking-widest">المسؤول</th>
                    <th className="text-right p-3 font-black text-primary/60 text-xs uppercase tracking-widest">الدور</th>
                    <th className="text-right p-3 font-black text-primary/60 text-xs uppercase tracking-widest">الإجراء</th>
                    <th className="text-right p-3 font-black text-primary/60 text-xs uppercase tracking-widest">النوع</th>
                    <th className="text-right p-3 font-black text-primary/60 text-xs uppercase tracking-widest">المحتوى</th>
                    <th className="text-right p-3 font-black text-primary/60 text-xs uppercase tracking-widest">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} data-testid={`log-row-${i}`}
                      className={`border-b border-primary/5 hover:bg-primary/2 transition-colors ${i % 2 === 0 ? "" : "bg-primary/[0.02]"}`}>
                      <td className="p-3 font-bold">{log.admin_name}</td>
                      <td className="p-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                          log.admin_role === "super_admin"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {log.admin_role === "super_admin" ? "مدير رئيسي" : "موظف"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          log.action.includes("حذف") ? "bg-red-100 text-red-700" :
                          log.action.includes("إضافة") ? "bg-green-100 text-green-700" :
                          log.action.includes("هدية") ? "bg-amber-100 text-amber-700" :
                          "bg-primary/10 text-primary/70"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-primary/60">{log.target_type}</td>
                      <td className="p-3 text-primary/80 max-w-xs truncate" title={log.target_name}>{log.target_name}</td>
                      <td className="p-3 text-primary/40 text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── STAFF MANAGEMENT TAB ── */}
      {activeTab === "staff" && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black">إدارة الموظفين</h2>
              <p className="text-primary/50 text-sm mt-1">أنشئ وأدر حسابات موظفي المحتوى</p>
            </div>
            <button
              data-testid="add-staff-btn"
              onClick={() => { setEditingStaff(null); setStaffForm({ username: "", password: "", display_name: "" }); setShowStaffForm(true); }}
              className="bg-primary text-secondary px-5 py-2 rounded-full font-bold hover:scale-105 transition-all"
            >
              + موظف جديد
            </button>
          </div>

          {/* Staff Form */}
          {showStaffForm && (
            <div className="bg-white border border-primary/15 rounded-2xl p-6 mb-6">
              <h3 className="font-black text-lg mb-4">{editingStaff ? "تعديل الموظف" : "إضافة موظف جديد"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-bold text-primary/70 mb-1 block">اسم المستخدم *</label>
                  <input
                    data-testid="staff-username-input"
                    type="text"
                    value={staffForm.username}
                    onChange={(e) => setStaffForm(f => ({ ...f, username: e.target.value }))}
                    disabled={!!editingStaff}
                    placeholder="مثال: staff1"
                    className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2.5 text-sm font-bold outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-primary/70 mb-1 block">الاسم الظاهر</label>
                  <input
                    data-testid="staff-displayname-input"
                    type="text"
                    value={staffForm.display_name}
                    onChange={(e) => setStaffForm(f => ({ ...f, display_name: e.target.value }))}
                    placeholder="مثال: أحمد محمد"
                    className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-primary/70 mb-1 block">{editingStaff ? "كلمة مرور جديدة" : "كلمة المرور *"}</label>
                  <input
                    data-testid="staff-password-input"
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="6 أحرف على الأقل"
                    className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2.5 text-sm font-bold outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  data-testid="save-staff-btn"
                  onClick={handleSaveStaff}
                  className="bg-primary text-secondary px-6 py-2 rounded-full font-bold hover:scale-105 transition-all"
                >
                  {editingStaff ? "حفظ التعديلات" : "إضافة الموظف"}
                </button>
                <button
                  onClick={() => { setShowStaffForm(false); setEditingStaff(null); }}
                  className="bg-primary/10 text-primary px-6 py-2 rounded-full font-bold hover:bg-primary/20 transition-all"
                >
                  إلغاء
                </button>
              </div>
              <p className="text-xs text-primary/40 mt-3">
                الموظف يستطيع إدارة الأسئلة والفئات وتوليد AI فقط — لا يرى المستخدمين أو الإحصاءات أو الإيرادات.
              </p>
            </div>
          )}

          {/* Staff List */}
          {staffList.length === 0 ? (
            <div className="text-center py-16 text-primary/30">
              <div className="text-5xl mb-3">👤</div>
              <div className="text-xl font-bold">لا يوجد موظفون بعد</div>
              <div className="text-sm mt-2">اضغط "+ موظف جديد" لإضافة موظف</div>
            </div>
          ) : (
            <div className="space-y-3">
              {staffList.map((staff) => (
                <div key={staff.id} data-testid={`staff-row-${staff.id}`}
                  className="bg-white border border-primary/10 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-lg">
                    {(staff.display_name || staff.username)[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-primary">{staff.display_name || staff.username}</div>
                    <div className="text-primary/50 text-xs">@{staff.username}</div>
                    <div className="text-primary/40 text-xs mt-0.5">
                      {new Date(staff.created_at).toLocaleDateString("ar-SA")} · صلاحيات: الأسئلة والفئات فقط
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      data-testid={`edit-staff-${staff.id}`}
                      onClick={() => { setEditingStaff(staff); setStaffForm({ username: staff.username, password: "", display_name: staff.display_name || "" }); setShowStaffForm(true); }}
                      className="text-primary/50 hover:text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                    >
                      تعديل
                    </button>
                    <button
                      data-testid={`delete-staff-${staff.id}`}
                      onClick={() => handleDeleteStaff(staff.id)}
                      className="text-red-400/60 hover:text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
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

      {/* ── AI GENERATOR TAB ── */}
      {activeTab === "ai" && (
        <div className="p-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🤖</span>
            <div>
              <h2 className="text-2xl font-black">توليد الأسئلة بالذكاء الاصطناعي</h2>
              <p className="text-primary/50 text-sm">أنشئ أسئلة حماسية ومتنوعة بضغطة زر</p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white border border-primary/10 rounded-2xl p-6 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-bold text-primary/70 mb-2 block">الفئة</label>
                <select
                  data-testid="ai-category-select"
                  value={aiCatId}
                  onChange={(e) => setAiCatId(e.target.value)}
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2.5 text-sm font-bold outline-none bg-white"
                >
                  <option value="">اختر فئة...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon || ""} {c.name}{c.is_premium ? " ⭐" : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-primary/70 mb-2 block">الصعوبة</label>
                <select
                  data-testid="ai-difficulty-select"
                  value={aiDiff}
                  onChange={(e) => setAiDiff(parseInt(e.target.value))}
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2.5 text-sm font-bold outline-none bg-white"
                >
                  <option value={300}>300 - سهل</option>
                  <option value={600}>600 - متوسط</option>
                  <option value={900}>900 - صعب</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-primary/70 mb-2 block">عدد الأسئلة</label>
                <input
                  data-testid="ai-count-input"
                  type="number"
                  min={3} max={20}
                  value={aiCount}
                  onChange={(e) => setAiCount(Math.min(20, Math.max(3, parseInt(e.target.value) || 10)))}
                  className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2.5 text-sm font-black outline-none text-center"
                />
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="mt-4">
              <label className="text-sm font-bold text-primary/70 mb-2 block">
                وصف مخصص للأسئلة (اختياري)
              </label>
              <textarea
                data-testid="ai-prompt-input"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="مثال: أسئلة ترفيهية مناسبة لمراهقين سعوديين عن كرة القدم السعودية... أو أسئلة صعبة عن تاريخ الدوري الإنجليزي الممتاز"
                rows={3}
                className="w-full border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none resize-none"
                style={{ fontFamily: "Cairo, sans-serif" }}
              />
              <p className="text-xs text-primary/40 mt-1">
                اكتب وصفاً ليتبعه الذكاء الاصطناعي عند توليد الأسئلة. اتركه فارغاً للتوليد التلقائي.
              </p>
            </div>

            <button
              data-testid="ai-generate-btn"
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiCatId}
              className="w-full mt-5 bg-primary text-secondary py-3.5 rounded-xl font-black text-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {aiGenerating ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  <span>جاري التوليد...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>ولّد {aiCount} سؤال</span>
                </>
              )}
            </button>
          </div>

          {/* Generated Questions Preview */}
          {aiQuestions.length > 0 && (
            <div className="bg-white border border-primary/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-lg">
                  {aiQuestions.length} سؤال جاهز للمراجعة
                </h3>
                <button
                  data-testid="ai-save-btn"
                  onClick={handleAiSave}
                  disabled={aiSaving}
                  className="bg-green-600 text-white px-6 py-2 rounded-xl font-black hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {aiSaving ? "جاري الحفظ..." : `💾 حفظ الكل (${aiQuestions.length})`}
                </button>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {aiQuestions.map((q, i) => (
                  <div key={q.id} className={`p-4 rounded-xl border ${q.difficulty === 300 ? "border-green-200 bg-green-50" : q.difficulty === 600 ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-primary/30 font-black text-sm shrink-0 mt-1">{i + 1}</span>
                      <div className="flex-1 space-y-2">
                        <textarea
                          value={q.text}
                          onChange={(e) => {
                            const updated = [...aiQuestions];
                            updated[i] = { ...q, text: e.target.value };
                            setAiQuestions(updated);
                          }}
                          rows={2}
                          className="w-full bg-white border border-primary/10 rounded-lg px-3 py-2 text-sm font-bold outline-none resize-none"
                          placeholder="نص السؤال"
                        />
                        <input
                          value={q.answer}
                          onChange={(e) => {
                            const updated = [...aiQuestions];
                            updated[i] = { ...q, answer: e.target.value };
                            setAiQuestions(updated);
                          }}
                          className="w-full bg-white border border-primary/10 rounded-lg px-3 py-2 text-sm outline-none"
                          placeholder="الإجابة"
                        />
                      </div>
                      <button
                        onClick={() => setAiQuestions(aiQuestions.filter((_, idx) => idx !== i))}
                        className="text-red-400/50 hover:text-red-500 text-lg shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiQuestions.length === 0 && !aiGenerating && (
            <div className="text-center py-12 text-primary/30">
              <div className="text-5xl mb-3">✨</div>
              <div className="font-bold">اختر الفئة والصعوبة واضغط توليد</div>
              <div className="text-sm mt-1">الذكاء الاصطناعي سيكتب لك أسئلة حماسية بالعربي</div>
            </div>
          )}
        </div>
      )}

      {/* ── EXPERIMENTAL MODE TAB ── */}
      {activeTab === "experimental" && (
        <div className="flex h-full" style={{ minHeight: "calc(100vh - 140px)" }}>

          {/* Left: Settings Panel */}
          <div className="w-72 border-l border-primary/10 p-4 flex-shrink-0 overflow-y-auto bg-secondary/5">
            <h3 className="font-black text-base mb-4 text-primary flex items-center gap-2">
              <span>🔓</span> إعدادات وضع التجربة
            </h3>

            {/* Enable/Disable toggle */}
            <div className="bg-white rounded-xl p-3 border border-primary/10 mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-primary">تفعيل وضع التجربة</span>
                <button
                  data-testid="trial-toggle"
                  onClick={() => setGameSettings({ ...gameSettings, trial_enabled: !gameSettings.trial_enabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${gameSettings.trial_enabled ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${gameSettings.trial_enabled ? "translate-x-5 left-0.5" : "translate-x-0 left-0.5"}`} />
                </button>
              </div>
              <p className="text-xs text-primary/50">{gameSettings.trial_enabled ? "مفعّل - المستخدمون المجانيون يلعبون" : "موقوف - لا يمكن للمجانيين اللعب"}</p>
            </div>

            {/* Use trial questions only */}
            <div className="bg-white rounded-xl p-3 border border-primary/10 mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-primary">أسئلة التجربة فقط</span>
                <button
                  data-testid="trial-questions-only-toggle"
                  onClick={() => setGameSettings({ ...gameSettings, trial_questions_only: !gameSettings.trial_questions_only })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${gameSettings.trial_questions_only ? "bg-blue-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${gameSettings.trial_questions_only ? "translate-x-5 left-0.5" : "translate-x-0 left-0.5"}`} />
                </button>
              </div>
              <p className="text-xs text-primary/50">إذا مفعّل: في وضع التجربة تظهر الأسئلة المعلّمة فقط</p>
            </div>

            {/* Team 1 Categories */}
            <div className="bg-white rounded-xl p-3 border border-red-200 mb-3">
              <h4 className="font-black text-sm text-red-600 mb-2">🔴 فئات الفريق الأول (3)</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {categories.map(cat => {
                  const sel = (gameSettings.trial_team1_categories || []).includes(cat.id);
                  return (
                    <label key={cat.id} className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-xs font-bold transition-all ${sel ? "bg-red-50 text-red-700" : "hover:bg-primary/5 text-primary/70"}`}>
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={(e) => {
                          const cur = gameSettings.trial_team1_categories || [];
                          const updated = e.target.checked
                            ? [...cur.filter(id => !((gameSettings.trial_team2_categories || []).includes(id) && id === cat.id)), cat.id].slice(0, 3)
                            : cur.filter(id => id !== cat.id);
                          setGameSettings({ ...gameSettings, trial_team1_categories: updated });
                        }}
                        className="w-3.5 h-3.5 accent-red-600"
                      />
                      {cat.icon || "🎯"} {cat.name}
                      {sel && <span className="text-[10px] text-red-400 mr-auto">✓</span>}
                    </label>
                  );
                })}
              </div>
              <div className="text-[10px] text-primary/30 mt-1">{(gameSettings.trial_team1_categories || []).length}/3 مختارة</div>
            </div>

            {/* Team 2 Categories */}
            <div className="bg-white rounded-xl p-3 border border-blue-200 mb-4">
              <h4 className="font-black text-sm text-blue-600 mb-2">🔵 فئات الفريق الثاني (3)</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {categories.map(cat => {
                  const sel = (gameSettings.trial_team2_categories || []).includes(cat.id);
                  return (
                    <label key={cat.id} className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-xs font-bold transition-all ${sel ? "bg-blue-50 text-blue-700" : "hover:bg-primary/5 text-primary/70"}`}>
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={(e) => {
                          const cur = gameSettings.trial_team2_categories || [];
                          const updated = e.target.checked
                            ? [...cur, cat.id].slice(0, 3)
                            : cur.filter(id => id !== cat.id);
                          setGameSettings({ ...gameSettings, trial_team2_categories: updated });
                        }}
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      {cat.icon || "🎯"} {cat.name}
                      {sel && <span className="text-[10px] text-blue-400 mr-auto">✓</span>}
                    </label>
                  );
                })}
              </div>
              <div className="text-[10px] text-primary/30 mt-1">{(gameSettings.trial_team2_categories || []).length}/3 مختارة</div>
            </div>

            <button
              data-testid="save-trial-settings-btn"
              onClick={saveSettings}
              className="w-full bg-primary text-secondary py-2.5 rounded-xl font-black hover:scale-[1.02] transition-all text-sm"
            >
              {settingsSaved ? "✓ تم الحفظ!" : "💾 حفظ الإعدادات"}
            </button>
          </div>

          {/* Right: Questions List */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-black text-lg text-primary">أسئلة وضع التجربة</h3>
                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {expQuestions.filter(q => q.is_experimental).length} معلّمة
                </span>
              </div>
              <div className="flex gap-2">
                <select
                  value={expCatFilter}
                  onChange={(e) => { setExpCatFilter(e.target.value); }}
                  className="border border-primary/20 rounded-lg px-2 py-1 text-xs font-bold outline-none bg-white"
                >
                  <option value="all">كل الفئات</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  value={expDiffFilter}
                  onChange={(e) => setExpDiffFilter(e.target.value)}
                  className="border border-primary/20 rounded-lg px-2 py-1 text-xs font-bold outline-none bg-white"
                >
                  <option value="all">كل الصعوبات</option>
                  <option value="300">300 - سهل</option>
                  <option value="600">600 - متوسط</option>
                  <option value="900">900 - صعب</option>
                </select>
                <button onClick={loadExpQuestions} className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-bold hover:bg-primary/20 transition-all">
                  تحديث
                </button>
              </div>
            </div>

            {/* Edit Form */}
            {expEditQ && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
                <h4 className="font-black text-sm text-amber-700 mb-3">تعديل السؤال</h4>
                <div className="space-y-2">
                  <textarea
                    value={expForm.text}
                    onChange={(e) => setExpForm({ ...expForm, text: e.target.value })}
                    rows={2}
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm font-bold outline-none resize-none"
                    placeholder="نص السؤال"
                  />
                  <div className="flex gap-2">
                    <input
                      value={expForm.answer}
                      onChange={(e) => setExpForm({ ...expForm, answer: e.target.value })}
                      className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm outline-none"
                      placeholder="الإجابة"
                    />
                    <select
                      value={expForm.difficulty}
                      onChange={(e) => setExpForm({ ...expForm, difficulty: parseInt(e.target.value) })}
                      className="border border-amber-300 rounded-lg px-2 py-2 text-sm outline-none bg-white font-bold"
                    >
                      <option value={300}>300</option>
                      <option value={600}>600</option>
                      <option value={900}>900</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveExpQ} className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-black hover:bg-amber-700 transition-all">حفظ التعديل</button>
                    <button onClick={() => { setExpEditQ(null); setExpForm({ text: "", answer: "", difficulty: 300, image_url: "", answer_image_url: "" }); }} className="px-4 bg-primary/10 text-primary py-2 rounded-lg text-sm font-bold">إلغاء</button>
                  </div>
                </div>
              </div>
            )}

            {/* Questions List */}
            {expLoading ? (
              <div className="text-center py-12 text-primary/40 font-bold">جاري التحميل...</div>
            ) : (
              <div className="space-y-2">
                {expQuestions
                  .filter(q => expCatFilter === "all" || q.category_id === expCatFilter)
                  .filter(q => expDiffFilter === "all" || q.difficulty === parseInt(expDiffFilter))
                  .map(q => {
                    const cat = categories.find(c => c.id === q.category_id);
                    const diffColor = q.difficulty === 300 ? "text-green-600 bg-green-50" : q.difficulty === 600 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
                    return (
                      <div
                        key={q.id}
                        data-testid={`exp-question-${q.id}`}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${q.is_experimental ? "border-green-300 bg-green-50/50" : "border-primary/10 bg-white hover:border-primary/20"}`}
                      >
                        {/* Experimental toggle */}
                        <button
                          title={q.is_experimental ? "إزالة من وضع التجربة" : "إضافة لوضع التجربة"}
                          onClick={() => handleToggleExp(q)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 transition-all ${q.is_experimental ? "bg-green-500 text-white shadow-md" : "bg-primary/10 text-primary/40 hover:bg-primary/20"}`}
                        >
                          {q.is_experimental ? "✓" : "○"}
                        </button>

                        {/* Question content */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-primary line-clamp-2 mb-0.5">{q.text}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-primary/50 bg-primary/5 px-1.5 py-0.5 rounded">{cat?.name || q.category_id}</span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${diffColor}`}>{q.difficulty}</span>
                            <span className="text-xs text-primary/50">الجواب: <span className="font-bold text-primary/70">{q.answer}</span></span>
                            {q.is_experimental && <span className="text-xs text-green-600 font-bold">✓ في التجربة</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => { setExpEditQ(q); setExpForm({ text: q.text, answer: q.answer, difficulty: q.difficulty, image_url: q.image_url || "", answer_image_url: q.answer_image_url || "" }); }}
                            className="w-7 h-7 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-xs hover:bg-amber-200 transition-all"
                            title="تعديل"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDeleteExpQ(q.id)}
                            className="w-7 h-7 bg-red-100 text-red-500 rounded-lg flex items-center justify-center text-xs hover:bg-red-200 transition-all"
                            title="حذف"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {expQuestions.filter(q => expCatFilter === "all" || q.category_id === expCatFilter).filter(q => expDiffFilter === "all" || q.difficulty === parseInt(expDiffFilter)).length === 0 && (
                  <div className="text-center py-10 text-primary/30">
                    <div className="text-3xl mb-2">📭</div>
                    <div className="font-bold">لا توجد أسئلة</div>
                  </div>
                )}
              </div>
            )}
          </div>
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

              {/* Question Image Upload */}
              <div>
                <label className="text-sm font-bold text-primary/70 mb-1 block">صورة السؤال (اختياري)</label>
                <div className="flex gap-2 items-center">
                  <label className="cursor-pointer flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-xl text-sm font-bold transition-all border border-primary/20">
                    <span>📷 رفع صورة</span>
                    <input
                      data-testid="question-image-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => uploadImage(e.target.files[0], (url) => setForm({ ...form, image_url: url }))}
                    />
                  </label>
                  <input
                    data-testid="question-image-input"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="أو الصق الرابط هنا"
                    className="flex-1 border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
                {form.image_url && (
                  <img src={form.image_url} alt="" className="mt-2 h-16 object-contain rounded-lg" onError={(e) => e.target.style.display = "none"} />
                )}
              </div>

              {/* Answer Image Upload */}
              <div>
                <label className="text-sm font-bold text-primary/70 mb-1 block">صورة الإجابة (اختياري)</label>
                <div className="flex gap-2 items-center">
                  <label className="cursor-pointer flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-xl text-sm font-bold transition-all border border-primary/20">
                    <span>📷 رفع صورة</span>
                    <input
                      data-testid="question-answer-image-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => uploadImage(e.target.files[0], (url) => setForm({ ...form, answer_image_url: url }))}
                    />
                  </label>
                  <input
                    data-testid="question-answer-image-input"
                    value={form.answer_image_url}
                    onChange={(e) => setForm({ ...form, answer_image_url: e.target.value })}
                    placeholder="أو الصق الرابط هنا"
                    className="flex-1 border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
                {form.answer_image_url && (
                  <img src={form.answer_image_url} alt="" className="mt-2 h-16 object-contain rounded-lg" onError={(e) => e.target.style.display = "none"} />
                )}
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
            <h3 className="text-xl font-black text-primary mb-4">{editingCat ? "تعديل الفئة" : "فئة جديدة"}</h3>
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
                <label className="text-sm font-bold text-primary/70 mb-1 block">صورة الفئة</label>
                <div className="flex gap-2 items-center mb-2">
                  <label className="cursor-pointer flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-xl text-sm font-bold transition-all border border-primary/20">
                    <span>📷 رفع صورة</span>
                    <input
                      data-testid="cat-image-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => uploadImage(e.target.files[0], (url) => setCatForm({ ...catForm, image_url: url }))}
                    />
                  </label>
                  <input
                    value={catForm.image_url}
                    onChange={(e) => setCatForm({ ...catForm, image_url: e.target.value })}
                    placeholder="أو الصق الرابط"
                    className="flex-1 border-2 border-primary/20 focus:border-primary rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catForm.is_premium}
                  onChange={(e) => setCatForm({ ...catForm, is_premium: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-bold text-yellow-700">⭐ فئة Premium (مقفولة للمجانيين)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  data-testid="cat-active-toggle"
                  type="checkbox"
                  checked={catForm.is_active !== false}
                  onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-bold text-green-700">✓ فئة مفعّلة (تظهر في اللعبة)</span>
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSaveCat} className="flex-1 bg-primary text-secondary py-2 rounded-xl font-bold">{editingCat ? "تحديث" : "حفظ"}</button>
              <button onClick={() => { setShowCatForm(false); setEditingCat(null); }} className="flex-1 bg-primary/10 text-primary py-2 rounded-xl font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
