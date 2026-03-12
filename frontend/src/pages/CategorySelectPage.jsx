import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import axios from "axios";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

export default function CategorySelectPage() {
  const navigate = useNavigate();
  const { session, updateSession, currentUser } = useGame();

  const [allCategories, setAllCategories] = useState([]);
  const [trialData, setTrialData] = useState(null); // {trial_team1_categories, trial_team2_categories, trial_enabled}
  const [team1Picks, setTeam1Picks] = useState([]);
  const [team2Picks, setTeam2Picks] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(1);
  const [loading, setLoading] = useState(true);

  const isFreeUser = !currentUser || currentUser.subscription_type !== "premium";

  useEffect(() => {
    if (!session) { navigate("/"); return; }

    // Load both all categories and trial settings in parallel
    Promise.all([
      axios.get(`${API}/categories`),
      axios.get(`${API}/free-categories`),
    ]).then(([{ data: cats }, { data: trial }]) => {
      setAllCategories(cats);
      setTrialData(trial);

      // Free users: auto-assign dynamic trial categories
      if (isFreeUser) {
        setTeam1Picks(trial.trial_team1_categories || []);
        setTeam2Picks(trial.trial_team2_categories || []);
      }
      setLoading(false);
    }).catch(() => {
      toast.error("خطأ في تحميل الفئات");
      setLoading(false);
    });
  }, [session, navigate]); // eslint-disable-line

  // Free users: start game with dynamic trial categories
  const startFreeGame = async () => {
    const t1 = trialData?.trial_team1_categories || [];
    const t2 = trialData?.trial_team2_categories || [];
    await updateSession({ team1_categories: t1, team2_categories: t2, status: "playing" });
    navigate("/game");
  };

  const handlePick = (catId) => {
    if (currentTeam === 1) {
      if (team1Picks.includes(catId)) {
        setTeam1Picks(team1Picks.filter(c => c !== catId));
      } else if (team1Picks.length < 3) {
        const newPicks = [...team1Picks, catId];
        setTeam1Picks(newPicks);
        if (newPicks.length === 3) toast.success(`✓ ${session.team1_name} اختار 3 فئات`);
      }
    } else {
      if (team2Picks.includes(catId)) {
        setTeam2Picks(team2Picks.filter(c => c !== catId));
      } else if (team2Picks.length < 3 && !team1Picks.includes(catId)) {
        const newPicks = [...team2Picks, catId];
        setTeam2Picks(newPicks);
        if (newPicks.length === 3) toast.success(`✓ ${session.team2_name} اختار 3 فئات`);
      }
    }
  };

  const handleNext = async () => {
    if (currentTeam === 1) {
      if (team1Picks.length < 3) { toast.error("اختر 3 فئات للفريق الأول!"); return; }
      setCurrentTeam(2);
    } else {
      if (team2Picks.length < 3) { toast.error("اختر 3 فئات للفريق الثاني!"); return; }
      await updateSession({ team1_categories: team1Picks, team2_categories: team2Picks, status: "playing" });
      navigate("/game");
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={DARK_BG}>
      <div className="text-secondary text-2xl animate-pulse">جاري التحميل...</div>
    </div>
  );

  // ── FREE USER VIEW ──
  if (isFreeUser) {
    const t1Ids = trialData?.trial_team1_categories || [];
    const t2Ids = trialData?.trial_team2_categories || [];
    const allTrialIds = [...new Set([...t1Ids, ...t2Ids])];
    const freeCats = allCategories.filter(c => allTrialIds.includes(c.id));

    if (!trialData?.trial_enabled) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4" style={DARK_BG}>
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-black text-secondary mb-4">وضع التجربة مغلق</h1>
            <p className="text-secondary/70 mb-6">اشترك للوصول الكامل للعبة</p>
            <button onClick={() => navigate("/pricing")} className="bg-secondary text-primary px-8 py-3 rounded-full font-black hover:scale-105 transition-all">
              الاشتراك الآن
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen px-4 py-8" style={DARK_BG}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6 animate-fade-in-up">
            <h1 className="text-3xl font-black text-secondary mb-2">الفئات المجانية</h1>
            <div className="bg-secondary/10 border border-secondary/25 rounded-xl px-4 py-3 max-w-md mx-auto">
              <p className="text-secondary/80 text-sm">
                هذه الفئات الثابتة للحساب المجاني.
                <button onClick={() => navigate("/pricing")} className="text-secondary font-bold underline mr-1 hover:no-underline">
                  اشترك الحين
                </button>
                للوصول لجميع الفئات وأسئلة لا تتكرر.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {freeCats.map((cat, i) => {
              const isT1 = t1Ids.includes(cat.id);
              return (
                <div
                  key={cat.id}
                  className="relative rounded-2xl overflow-hidden"
                  style={{ border: `2px solid ${isT1 ? "rgba(239,68,68,0.4)" : "rgba(59,130,246,0.4)"}`, minHeight: "120px", animationDelay: `${0.05 * i}s` }}
                >
                  {cat.image_url ? (
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${cat.image_url})` }} />
                  ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${cat.color || "#5B0E14"}, #0f0102)` }} />
                  )}
                  <div className="absolute inset-0 bg-black/50" />
                  <div className="relative z-10 p-4 flex flex-col items-center text-center">
                    <div className="text-secondary font-black text-base mb-1">{cat.name}</div>
                    <div className={`text-xs font-bold ${isT1 ? "text-red-300" : "text-blue-300"}`}>
                      {isT1 ? `🔴 ${session?.team1_name}` : `🔵 ${session?.team2_name}`}
                    </div>
                    <div className="mt-1.5 text-secondary/40 text-[10px]">🔒 ثابتة</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center">
            <button
              data-testid="start-free-game-btn"
              onClick={startFreeGame}
              className="bg-secondary text-primary px-12 py-4 rounded-full font-black text-xl hover:scale-105 transition-all"
              style={{ boxShadow: "0 0 30px rgba(241,225,148,0.3)" }}
            >
              ابدأ اللعبة! 🎮
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PREMIUM USER VIEW ──
  const picks = currentTeam === 1 ? team1Picks : team2Picks;
  const teamName = currentTeam === 1 ? session?.team1_name : session?.team2_name;
  const teamColor = currentTeam === 1 ? "🔴" : "🔵";

  return (
    <div className="min-h-screen px-4 py-8" style={DARK_BG}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 animate-fade-in-up">
          <div className="text-secondary/60 text-sm mb-2">الخطوة {currentTeam} من 2</div>
          <h1 className="text-4xl font-black text-secondary">{teamColor} {teamName}</h1>
          <p className="text-secondary/70 text-lg mt-2">
            اختر <span className="text-secondary font-black text-xl">{3 - picks.length}</span> فئة
            {picks.length > 0 && ` (اخترت ${picks.length})`}
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2].map(t => (
            <div key={t} className={`h-3 rounded-full transition-all duration-300 ${t === currentTeam ? "w-8 bg-secondary" : t < currentTeam ? "w-3 bg-secondary/60" : "w-3 bg-secondary/20"}`} />
          ))}
        </div>

        {currentTeam === 2 && team1Picks.length > 0 && (
          <div className="bg-green-900/40 border border-green-500/30 rounded-xl p-3 mb-4 text-center">
            <span className="text-green-400 text-sm font-bold">
              ✓ {session?.team1_name}: {team1Picks.map(id => allCategories.find(c => c.id === id)?.name).join(" • ")}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {allCategories.map((cat, i) => {
            const isSelected = picks.includes(cat.id);
            const isOtherTeam = currentTeam === 2 && team1Picks.includes(cat.id);
            const isDisabled = isOtherTeam && !picks.includes(cat.id);

            return (
              <button
                key={cat.id}
                data-testid={`category-${cat.id}`}
                onClick={() => !isDisabled && handlePick(cat.id)}
                disabled={isDisabled}
                className={`
                  relative rounded-2xl overflow-hidden aspect-video flex flex-col justify-end
                  border-2 transition-all duration-300
                  ${isSelected ? "border-secondary scale-105 shadow-[0_0_25px_rgba(241,225,148,0.5)]"
                    : isDisabled ? "border-primary/10 opacity-30 cursor-not-allowed"
                    : "border-secondary/20 hover:border-secondary hover:scale-105 cursor-pointer"}
                `}
                style={{ animationDelay: `${0.05 * i}s`, minHeight: "100px" }}
              >
                {cat.image_url ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${cat.image_url})` }} />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${cat.color || "#5B0E14"}, #0f0102)` }} />
                )}
                <div className={`absolute inset-0 transition-all ${isSelected ? "bg-secondary/40" : "bg-black/50 hover:bg-black/40"}`} />
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-secondary text-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-black z-10">✓</div>
                )}
                <div className="relative z-10 p-3 text-center">
                  <span className={`font-black text-sm leading-tight drop-shadow-lg ${isSelected ? "text-primary" : "text-secondary"}`}>
                    {cat.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            data-testid="next-btn"
            onClick={handleNext}
            disabled={picks.length < 3}
            className={`px-12 py-4 rounded-full font-black text-xl transition-all duration-300
              ${picks.length === 3
                ? "bg-secondary text-primary hover:scale-105 hover:shadow-[0_0_30px_rgba(241,225,148,0.5)]"
                : "bg-secondary/20 text-secondary/40 cursor-not-allowed"}`}
          >
            {currentTeam === 1 ? "التالي ←" : "ابدأ اللعبة! 🎮"}
          </button>
        </div>
      </div>
    </div>
  );
}
