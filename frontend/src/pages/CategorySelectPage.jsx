import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useGame } from "@/context/GameContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CategorySelectPage() {
  const navigate = useNavigate();
  const { session, updateSession, saveSession, currentUser, darkMode, refreshUser, userToken } = useGame();

  const [categories, setCategories]       = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [freeData, setFreeData]           = useState(null);
  const [selected, setSelected]           = useState({ team1: [], team2: [] });
  const [step, setStep]                   = useState(1);   // 1 = team1, 2 = team2
  const [loading, setLoading]             = useState(false);
  const [activeGroupId, setActiveGroupId] = useState("all");

  const isPremiumUser = currentUser?.subscription_type === "premium";
  const NEEDED = 3;

  useEffect(() => {
    if (!session) { navigate("/setup"); return; }
    if (userToken) refreshUser();
    loadCategories();
  }, []); // eslint-disable-line

  const loadCategories = async () => {
    const [allRes, freeRes, groupsRes] = await Promise.all([
      axios.get(`${API}/categories`),
      axios.get(`${API}/free-categories`),
      axios.get(`${API}/category-groups`),
    ]);
    setCategories(allRes.data);
    setFreeData(freeRes.data);
    setCategoryGroups(groupsRes.data || []);

    if (!isPremiumUser) {
      setSelected({
        team1: freeRes.data.trial_team1_categories || [],
        team2: freeRes.data.trial_team2_categories || [],
      });
    }
  };

  const handleCategoryClick = (cat) => {
    if (cat.is_premium && !isPremiumUser) {
      toast.error("هذه الفئة متاحة للمشتركين فقط — اشترك في Premium للوصول إليها!", {
        duration: 3000,
        icon: "🔒",
      });
      return;
    }

    const team = step === 1 ? "team1" : "team2";
    const current = selected[team];

    if (current.includes(cat.id)) {
      // Deselect
      setSelected(prev => ({ ...prev, [team]: prev[team].filter(id => id !== cat.id) }));
    } else {
      if (current.length >= NEEDED) {
        toast.error(`يمكنك اختيار ${NEEDED} فئات فقط لكل فريق`);
        return;
      }
      setSelected(prev => ({ ...prev, [team]: [...prev[team], cat.id] }));
    }
  };

  const handleConfirm = async () => {
    if (!isPremiumUser) {
      // For free users, go straight to start with auto-assigned trial cats
      await startGame(selected.team1, selected.team2);
      return;
    }

    if (step === 1) {
      if (selected.team1.length < NEEDED) {
        toast.error(`اختر ${NEEDED} فئات للفريق الأول`); return;
      }
      setStep(2);
      return;
    }

    if (selected.team2.length < NEEDED) {
      toast.error(`اختر ${NEEDED} فئات للفريق الثاني`); return;
    }

    // Check no overlap
    const overlap = selected.team1.filter(id => selected.team2.includes(id));
    if (overlap.length > 0) {
      toast.error("لا يمكن اختيار نفس الفئة للفريقين!");
      return;
    }

    await startGame(selected.team1, selected.team2);
  };

  const startGame = async (t1Cats, t2Cats) => {
    setLoading(true);
    try {
      const updated = await updateSession({
        team1_categories: t1Cats,
        team2_categories: t2Cats,
      });
      if (updated) {
        navigate("/game");
      }
    } catch (e) {
      toast.error("حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const team1Sel = selected.team1;
  const team2Sel = selected.team2;
  const activeSel = step === 1 ? team1Sel : team2Sel;
  const teamName  = step === 1 ? session?.team1_name : session?.team2_name;
  const teamColor = step === 1 ? "#ef4444" : "#3b82f6";

  const bg = darkMode
    ? "linear-gradient(155deg, #1A2B18 0%, #1C2E1A 35%, #1F3020 70%, #172715 100%)"
    : "linear-gradient(155deg, #F3EBD3 0%, #E4D9BB 35%, #C7D3A4 70%, #B5C592 100%)";
  const textMain = darkMode ? "#C7D3A4" : "#2C3A1A";
  const textSub  = darkMode ? "#8AAA68" : "#5A6A3A";

  const otherTeamSel = step === 1 ? team2Sel : team1Sel;

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg }}>

      {/* Header */}
      <div className="py-4 px-4 text-center border-b" style={{ borderColor: darkMode ? "rgba(120,170,90,0.2)" : "rgba(0,0,0,0.08)" }}>
        <h1 className="font-black text-3xl" style={{ color: textMain, fontFamily: "Cairo, sans-serif" }}>
          اختيار الفئات
        </h1>
        {!isPremiumUser && freeData?.trial_enabled ? (
          <p className="mt-1 text-sm font-bold" style={{ color: textSub }}>
            وضع التجربة — الفئات محددة مسبقاً. اشترك في Premium لاختيار فئاتك!
          </p>
        ) : (
          <p className="mt-1 text-sm font-bold" style={{ color: teamColor }}>
            {teamName} — اختر {NEEDED} فئات ({activeSel.length}/{NEEDED})
          </p>
        )}
      </div>

      {/* Teams progress bar */}
      {isPremiumUser && (
        <div className="flex gap-3 px-4 py-3">
          {[1, 2].map(t => {
            const tName = t === 1 ? session?.team1_name : session?.team2_name;
            const tColor = t === 1 ? "#ef4444" : "#3b82f6";
            const tSel = t === 1 ? team1Sel : team2Sel;
            const isActive = step === t;
            return (
              <div
                key={t}
                className="flex-1 rounded-2xl px-4 py-2 flex items-center justify-between transition-all"
                style={{
                  background: isActive ? `${tColor}22` : darkMode ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.5)",
                  border: `2px solid ${isActive ? tColor : "transparent"}`,
                  opacity: step > t ? 0.6 : 1,
                }}
              >
                <span className="font-black" style={{ color: tColor, fontSize: "0.9rem" }}>{tName}</span>
                <div className="flex gap-1">
                  {Array.from({ length: NEEDED }).map((_, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border-2"
                      style={{
                        background: i < tSel.length ? tColor : "transparent",
                        borderColor: tColor,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Grid */}
      <div className="flex-1 px-3 pb-4 overflow-y-auto">
        {/* Group Filter Tabs */}
        {categoryGroups.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4 px-1">
            <button
              data-testid="group-filter-all"
              onClick={() => setActiveGroupId("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all border ${
                activeGroupId === "all"
                  ? "bg-primary text-secondary border-primary"
                  : "bg-white/10 text-secondary/70 border-secondary/20 hover:border-secondary/50"
              }`}
            >
              الكل ({categories.length})
            </button>
            {categoryGroups.map(g => {
              const count = categories.filter(c => c.group_id === g.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={g.id}
                  data-testid={`group-filter-${g.id}`}
                  onClick={() => setActiveGroupId(g.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all border ${
                    activeGroupId === g.id
                      ? "text-white border-transparent"
                      : "bg-white/10 text-secondary/70 border-secondary/20 hover:border-secondary/50"
                  }`}
                  style={activeGroupId === g.id ? { background: g.color, borderColor: g.color } : {}}
                >
                  {g.icon} {g.name} ({count})
                </button>
              );
            })}
          </div>
        )}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(clamp(160px, 20vw, 240px), 1fr))",
          }}
        >
          {categories
            .filter(cat => activeGroupId === "all" || cat.group_id === activeGroupId)
            .map(cat => {
            const isLockedPremium = cat.is_premium && !isPremiumUser;
            const isSelectedForCurrent = activeSel.includes(cat.id);
            const isSelectedForOther   = otherTeamSel.includes(cat.id);
            const isTrialAssignedT1 = !isPremiumUser && freeData?.trial_team1_categories?.includes(cat.id);
            const isTrialAssignedT2 = !isPremiumUser && freeData?.trial_team2_categories?.includes(cat.id);
            const isTrialAssigned   = isTrialAssignedT1 || isTrialAssignedT2;

            let ringColor = "transparent";
            let ringWidth = "0px";
            if (isSelectedForCurrent) { ringColor = teamColor; ringWidth = "3px"; }
            else if (isTrialAssignedT1) { ringColor = "#ef4444"; ringWidth = "2.5px"; }
            else if (isTrialAssignedT2) { ringColor = "#3b82f6"; ringWidth = "2.5px"; }

            return (
              <div
                key={cat.id}
                data-testid={`cat-card-${cat.id}`}
                onClick={() => {
                  if (!isPremiumUser) {
                    if (isLockedPremium) {
                      toast.error("هذه الفئة متاحة للمشتركين فقط!", { icon: "🔒" });
                    }
                    // Free users can't change assignment; just show info
                    return;
                  }
                  if (isSelectedForOther && isPremiumUser) {
                    toast.error("هذه الفئة مختارة للفريق الآخر"); return;
                  }
                  handleCategoryClick(cat);
                }}
                className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 select-none"
                style={{
                  border: `${ringWidth} solid ${ringColor}`,
                  boxShadow: isSelectedForCurrent
                    ? `0 0 20px ${teamColor}55, 0 4px 12px rgba(0,0,0,0.15)`
                    : "0 4px 12px rgba(0,0,0,0.1)",
                  opacity: isLockedPremium ? 0.8 : isSelectedForOther ? 0.5 : 1,
                  transform: isSelectedForCurrent ? "scale(1.03)" : "scale(1)",
                  background: darkMode ? "rgba(28,42,26,0.95)" : "rgba(255,255,255,0.92)",
                minHeight: "clamp(160px, 24vw, 240px)",
                }}
              >
                {/* Lock overlay for premium */}
                {isLockedPremium && (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl"
                    style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
                  >
                    <Lock size={28} className="text-yellow-400" />
                    <span className="text-yellow-300 font-black text-xs text-center px-2">Premium فقط</span>
                  </div>
                )}

                {/* Trial assignment badge */}
                {isTrialAssigned && !isPremiumUser && (
                  <div
                    className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-xs font-black"
                    style={{
                      background: isTrialAssignedT1 ? "rgba(239,68,68,0.9)" : "rgba(59,130,246,0.9)",
                      color: "white",
                    }}
                  >
                    {isTrialAssignedT1 ? session?.team1_name : session?.team2_name}
                  </div>
                )}

                {/* Selected check mark */}
                {isSelectedForCurrent && isPremiumUser && (
                  <div
                    className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center font-black text-white text-sm"
                    style={{ background: teamColor }}
                  >
                    ✓
                  </div>
                )}

                {/* Premium crown badge */}
                {cat.is_premium && (
                  <div
                    className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-xs font-black"
                    style={{ background: "rgba(234,179,8,0.9)", color: "white" }}
                  >
                    ⭐ Premium
                  </div>
                )}

                {/* Category image */}
                <div
                  className="w-full flex items-center justify-center overflow-hidden"
                  style={{ height: "clamp(110px, 18vw, 180px)" }}
                >
                  {cat.image_url ? (
                    <img
                      src={cat.image_url}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${cat.color || "#5B0E14"}33, ${cat.color || "#5B0E14"}11)` }}
                    >
                      <span style={{ fontSize: "clamp(3rem, 7vw, 5rem)" }}>{cat.icon || "🎯"}</span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="px-3 py-2.5">
                  <div
                    className="font-black text-center"
                    style={{
                      color: textMain,
                      fontSize: "clamp(0.9rem, 1.8vw, 1.15rem)",
                      fontFamily: "Cairo, sans-serif",
                    }}
                  >
                    {cat.icon && <span className="ml-1">{cat.icon}</span>}
                    {cat.name}
                  </div>
                  {cat.description && (
                    <div
                      className="text-center mt-0.5 truncate"
                      style={{ color: textSub, fontSize: "0.7rem" }}
                    >
                      {cat.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="shrink-0 px-4 pb-5 pt-3 border-t" style={{ borderColor: darkMode ? "rgba(120,170,90,0.2)" : "rgba(0,0,0,0.08)" }}>
        {isPremiumUser ? (
          <div className="flex gap-3">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-2xl font-black text-lg transition-all"
                style={{
                  background: darkMode ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.7)",
                  color: textMain,
                  border: `2px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                }}
              >
                رجوع
              </button>
            )}
            <button
              data-testid="confirm-categories-btn"
              onClick={handleConfirm}
              disabled={loading || activeSel.length < NEEDED}
              className="flex-1 py-3 rounded-2xl font-black text-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{ background: teamColor, color: "white" }}
            >
              {loading ? "جاري التحميل..." : step === 1 ? `التالي — ${session?.team2_name} ←` : "ابدأ اللعبة!"}
            </button>
          </div>
        ) : (
          <button
            data-testid="confirm-categories-btn"
            onClick={handleConfirm}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-black text-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #5B0E14, #9A1E28)", color: "#F1E194" }}
          >
            {loading ? "جاري التحميل..." : "ابدأ اللعبة! 🎮"}
          </button>
        )}

        {!isPremiumUser && (
          <p className="text-center mt-2 text-xs font-bold" style={{ color: textSub }}>
            <span
              className="cursor-pointer underline"
              onClick={() => navigate("/pricing")}
              style={{ color: "#B8860B" }}
            >
              اشترك في Premium
            </span>
            {" "}لاختيار فئاتك بحرية والوصول لـ 10 فئات إضافية
          </p>
        )}
      </div>
    </div>
  );
}
