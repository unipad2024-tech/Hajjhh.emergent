import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

const TIMER_DURATION = 75;

export default function QuestionPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { session, updateScore } = useGame();
  const { question, catName, slot } = state || {};

  const [timeLeft, setTimeLeft]       = useState(TIMER_DURATION);
  const [timerOn, setTimerOn]         = useState(true);
  const [showAnswer, setShowAnswer]   = useState(false);
  const [assigned, setAssigned]       = useState(false);
  const [scoredTeam, setScoredTeam]   = useState(null);
  const [tensionDone, setTensionDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!timerOn || timeLeft <= 0) return;
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, timerOn]);

  useEffect(() => {
    if (timeLeft === 10 && !tensionDone && timerOn) { setTensionDone(true); playTension(); }
    if (timeLeft === 0 && timerOn) {
      setTimerOn(false);
      playBuzz();
      toast.error("⏰ انتهى الوقت!", { duration: 3000 });
    }
  }, [timeLeft, timerOn, tensionDone]);

  const playTension = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const schedule = (freq, t, dur) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "triangle"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + dur + 0.01);
      };
      for (let i = 0; i < 10; i++) schedule(i % 2 === 0 ? 830 : 600, i * 0.85, 0.35);
    } catch {}
  };

  const playBuzz = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sawtooth"; osc.frequency.value = 150;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
    } catch {}
  };

  const playCorrect = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const schedule = (freq, t, dur) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + dur + 0.01);
      };
      [523, 659, 784, 1047].forEach((f, i) => schedule(f, i * 0.12, 0.25));
    } catch {}
  };

  const handleReveal = () => { setTimerOn(false); setShowAnswer(true); };

  const handleAssign = async (team) => {
    if (assigned) return;
    const pts = question?.difficulty || 200;
    await updateScore(team, pts);
    setScoredTeam(team);
    setAssigned(true);
    playCorrect();
    window.dispatchEvent(new Event("scoreUpdated"));
    toast.success(`+${pts} ✓`, { duration: 2000 });
  };

  const handleSkip = () => setAssigned(true);
  const handleBack = () => navigate("/game");

  if (!question) { navigate("/game"); return null; }

  const pct  = (timeLeft / TIMER_DURATION) * 100;
  const R    = 44;
  const circ = 2 * Math.PI * R;
  const dash = circ * (1 - pct / 100);
  const col  = timeLeft > 20 ? "#F1E194" : timeLeft > 10 ? "#f59e0b" : "#ef4444";
  const isSecret = question.question_type === "secret_word";
  const secretUrl = `${window.location.origin}/secret/${question.id}`;
  const slotColor = slot === 1 ? "text-red-300" : "text-blue-300";
  const slotLabel = slot === 1 ? `🔴 ${session?.team1_name}` : `🔵 ${session?.team2_name}`;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ minHeight: "100svh", background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" }}
    >
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <button
          data-testid="back-to-board"
          onClick={handleBack}
          className="text-secondary/40 hover:text-secondary text-sm transition-colors"
        >
          ← اللوحة
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold ${slotColor}`}>{slotLabel}</span>
          <span className="text-secondary/30 text-xs">|</span>
          <span className="text-secondary/60 text-xs">{catName}</span>
          <span className="text-secondary/30 text-xs">|</span>
          <span
            className="text-sm font-black"
            style={{ color: question.difficulty === 200 ? "#6ee7b7" : question.difficulty === 400 ? "#fcd34d" : "#f87171" }}
          >
            {question.difficulty} نقطة
          </span>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="text-center">
            <div className="text-red-300/70 font-bold">{session?.team1_name}</div>
            <div className="text-secondary font-black text-base">{session?.team1_score || 0}</div>
          </div>
          <div className="text-secondary/20 flex items-center">VS</div>
          <div className="text-center">
            <div className="text-blue-300/70 font-bold">{session?.team2_name}</div>
            <div className="text-secondary font-black text-base">{session?.team2_score || 0}</div>
          </div>
        </div>
      </div>

      {/* ── Main Area: Timer at top, Question fills height ── */}
      <div className="flex-1 flex flex-col items-center gap-2 px-3 md:px-6 pb-3 overflow-hidden">

        {/* ── Timer (always at top center) ── */}
        <div className="shrink-0 flex flex-col items-center">
          <svg width="110" height="110" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={R} fill="rgba(0,0,0,0.4)" stroke="rgba(241,225,148,0.08)" strokeWidth="9"/>
            <circle
              cx="50" cy="50" r={R}
              fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={dash}
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s" }}
            />
            <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
              fill={col} fontSize="26" fontWeight="900" fontFamily="Cairo,sans-serif"
              className={timeLeft <= 10 ? "animate-countdown" : ""}
            >
              {timeLeft}
            </text>
          </svg>
        </div>

        {/* ── Question Card (fills remaining height, full width) ── */}
        <div className="flex-1 w-full overflow-hidden" style={{ maxWidth: "100%" }}>
          <div className="h-full bg-primary/70 border-2 border-secondary/25 rounded-3xl p-4 md:p-8 lg:p-10 backdrop-blur-sm shadow-2xl flex flex-col"
            style={{ boxShadow: "0 0 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(241,225,148,0.1)" }}
          >
            {isSecret ? (
              <div className="flex flex-col items-center justify-center flex-1">
                <div className="text-secondary text-xl md:text-3xl font-black mb-2">وصّف الكلمة السرية</div>
                <div className="text-secondary/60 text-sm mb-5">الملاعب يمسح الـ QR — بس هو يشوف الكلمة!</div>
                <div className="bg-white p-4 rounded-2xl" style={{ boxShadow: "0 0 30px rgba(241,225,148,0.3)" }}>
                  <QRCodeSVG value={secretUrl} size={Math.min(window.innerWidth - 100, 200)} data-testid="qr-code"/>
                </div>
                <p className="text-secondary/25 text-[10px] font-mono break-all max-w-xs mt-3">{secretUrl}</p>
              </div>
            ) : (
              <div className="flex flex-col justify-center flex-1 min-h-0">
                {question.image_url && (
                  <img
                    src={question.image_url}
                    alt="question"
                    data-testid="question-image"
                    className="mx-auto mb-4 object-contain rounded-xl border border-secondary/15"
                    style={{ maxHeight: "clamp(100px, 20vh, 220px)" }}
                    onError={e => e.target.style.display = "none"}
                  />
                )}
                <p
                  data-testid="question-text"
                  className="text-secondary font-bold leading-relaxed text-center"
                  style={{ fontSize: "clamp(1.4rem, 3.5vw, 2.8rem)", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
                >
                  {question.text}
                </p>
              </div>
            )}

            {/* Reveal Button */}
            {!showAnswer && (
              <div className="flex justify-center mt-4 shrink-0">
                <button
                  data-testid="reveal-answer-btn"
                  onClick={handleReveal}
                  className="bg-secondary/15 border-2 border-secondary/50 text-secondary px-8 md:px-12 py-3 rounded-full font-bold text-base md:text-lg hover:bg-secondary hover:text-primary transition-all duration-300 hover:scale-105"
                >
                  عرض الإجابة
                </button>
              </div>
            )}

            {/* Answer */}
            {showAnswer && (
              <div className="mt-4 border-t border-secondary/15 pt-4 shrink-0 animate-slide-up">
                {question.answer_image_url && (
                  <img src={question.answer_image_url} alt="answer" data-testid="answer-image"
                    className="mx-auto mb-3 max-h-24 md:max-h-32 object-contain rounded-xl"
                    onError={e => e.target.style.display = "none"} />
                )}
                <div className="text-secondary/50 text-xs text-center uppercase tracking-widest mb-1">الإجابة</div>
                <div
                  data-testid="answer-text"
                  className="text-secondary font-black text-center"
                  style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", textShadow: "0 0 25px rgba(241,225,148,0.4)" }}
                >
                  {question.answer}
                </div>

                {/* Score buttons */}
                {!assigned && (
                  <div className="mt-4">
                    <div className="text-secondary/50 text-sm text-center mb-3">من أجاب صح؟</div>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <button
                        data-testid="assign-team1-btn"
                        onClick={() => handleAssign(1)}
                        className="flex flex-col items-center bg-gradient-to-br from-red-700 to-red-950 border-2 border-red-400/50 text-white px-5 py-3 rounded-2xl font-bold hover:scale-105 hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all min-w-[110px]"
                      >
                        <span className="text-sm">🔴 {session?.team1_name}</span>
                        <span className="text-2xl font-black text-red-200">+{question.difficulty}</span>
                      </button>
                      <button
                        data-testid="assign-team2-btn"
                        onClick={() => handleAssign(2)}
                        className="flex flex-col items-center bg-gradient-to-br from-blue-700 to-blue-950 border-2 border-blue-400/50 text-white px-5 py-3 rounded-2xl font-bold hover:scale-105 hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all min-w-[110px]"
                      >
                        <span className="text-sm">🔵 {session?.team2_name}</span>
                        <span className="text-2xl font-black text-blue-200">+{question.difficulty}</span>
                      </button>
                      <button
                        data-testid="skip-points-btn"
                        onClick={handleSkip}
                        className="border border-secondary/20 text-secondary/40 px-4 py-3 rounded-2xl font-bold text-sm hover:text-secondary/70 transition-all self-center"
                      >
                        لا أحد
                      </button>
                    </div>
                  </div>
                )}

                {assigned && (
                  <div className="mt-4 flex flex-col items-center gap-3 animate-fade-in-up">
                    {scoredTeam && (
                      <div className="text-secondary font-black text-xl">
                        +{question.difficulty} ✓ {scoredTeam === 1 ? session?.team1_name : session?.team2_name}
                      </div>
                    )}
                    <button
                      data-testid="continue-btn"
                      onClick={handleBack}
                      className="bg-secondary text-primary px-10 py-3 rounded-full font-black text-lg hover:scale-105 animate-pulse-glow transition-all"
                    >
                      العودة للوحة ←
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
