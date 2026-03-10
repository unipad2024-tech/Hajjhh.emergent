import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

const TIMER_DURATION = 75;

export default function QuestionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, updateScore } = useGame();
  const { question, catName } = location.state || {};

  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [timerActive, setTimerActive] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [pointsAssigned, setPointsAssigned] = useState(false);
  const [tensionPlayed, setTensionPlayed] = useState(false);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, timerActive]);

  // Tension sound at 10s
  useEffect(() => {
    if (timeLeft === 10 && !tensionPlayed && timerActive) {
      setTensionPlayed(true);
      playTensionSound();
    }
    if (timeLeft === 0 && timerActive) {
      setTimerActive(false);
      toast.error("انتهى الوقت!");
    }
  }, [timeLeft, timerActive, tensionPlayed]);

  const playTensionSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (freq, time, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);
        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + dur);
      };
      for (let i = 0; i < 10; i++) {
        beep(i % 2 === 0 ? 880 : 660, i * 0.9, 0.4);
      }
    } catch (e) {}
  };

  const handleRevealAnswer = () => {
    setTimerActive(false);
    setShowAnswer(true);
  };

  const handleAssignPoints = async (team) => {
    if (pointsAssigned) return;
    const points = question?.difficulty || 200;
    await updateScore(team, points);
    setPointsAssigned(true);
    window.dispatchEvent(new Event("scoreUpdated"));
    toast.success(`+${points} نقطة للفريق ${team === 1 ? session?.team1_name : session?.team2_name}!`);
  };

  const handleBack = () => navigate("/game");

  if (!question) {
    navigate("/game");
    return null;
  }

  const progress = (timeLeft / TIMER_DURATION) * 100;
  const timerColor = timeLeft > 20 ? "#F1E194" : timeLeft > 10 ? "#f59e0b" : "#ef4444";
  const isSecret = question.question_type === "secret_word";
  const frontendUrl = window.location.origin;
  const secretUrl = `${frontendUrl}/secret/${question.id}`;

  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div className="min-h-screen game-board-bg pattern-overlay flex flex-col items-center justify-start px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4">
        <button data-testid="back-to-board" onClick={handleBack} className="text-secondary/50 hover:text-secondary transition-colors text-sm">
          ← اللوحة
        </button>
        <div className="text-center">
          <div className="text-secondary/60 text-sm">{catName}</div>
          <div className="text-secondary font-black text-lg">{question.difficulty} نقطة</div>
        </div>
        <div className="text-secondary/50 text-sm">
          {session?.team1_name} vs {session?.team2_name}
        </div>
      </div>

      {/* Timer */}
      <div className="mb-6">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="36" fill="rgba(91,14,20,0.5)" stroke="rgba(241,225,148,0.1)" strokeWidth="8" />
          <circle
            className="timer-circle"
            cx="50" cy="50" r="36"
            fill="none"
            stroke={timerColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
          />
          <text
            x="50" y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fill={timerColor}
            fontSize="22"
            fontWeight="900"
            fontFamily="Cairo, sans-serif"
            className={timeLeft <= 10 ? "animate-countdown-flash" : ""}
          >
            {timeLeft}
          </text>
        </svg>
      </div>

      {/* Question Card */}
      <div className="w-full max-w-3xl animate-scale-in">
        <div className="bg-primary/80 border-2 border-secondary/30 rounded-3xl p-6 md:p-10 text-center backdrop-blur-sm">
          {isSecret ? (
            // Secret Word Mode - Show QR
            <div className="flex flex-col items-center">
              <div className="text-secondary text-xl font-bold mb-4">
                وصّف الكلمة السرية لفريقك!
              </div>
              <div className="text-secondary/70 text-sm mb-6">
                الملاعب يمسح الـ QR ويشوف الكلمة على تلفونه — هو بس يشوفها!
              </div>
              <div className="bg-white p-4 rounded-2xl qr-glow">
                <QRCodeSVG
                  value={secretUrl}
                  size={200}
                  data-testid="qr-code"
                />
              </div>
              <div className="mt-4 text-secondary/40 text-xs font-mono">{secretUrl}</div>
            </div>
          ) : (
            // Regular Question
            <>
              {question.image_url && (
                <img
                  src={question.image_url}
                  alt="question"
                  data-testid="question-image"
                  className="mx-auto mb-6 max-h-48 md:max-h-64 object-contain rounded-xl border border-secondary/20"
                  onError={(e) => e.target.style.display = "none"}
                />
              )}
              <p data-testid="question-text" className="text-secondary text-2xl md:text-4xl font-bold leading-relaxed">
                {question.text}
              </p>
            </>
          )}

          {/* Reveal Answer Button */}
          {!showAnswer && (
            <button
              data-testid="reveal-answer-btn"
              onClick={handleRevealAnswer}
              className="mt-8 bg-secondary/20 border-2 border-secondary/50 text-secondary px-8 py-3 rounded-full font-bold hover:bg-secondary hover:text-primary transition-all duration-300"
            >
              عرض الإجابة
            </button>
          )}

          {/* Answer Reveal */}
          {showAnswer && (
            <div className="mt-8 animate-scale-in">
              <div className="border-t border-secondary/20 pt-6">
                {question.answer_image_url && (
                  <img
                    src={question.answer_image_url}
                    alt="answer"
                    data-testid="answer-image"
                    className="mx-auto mb-4 max-h-40 object-contain rounded-xl border border-secondary/20"
                    onError={(e) => e.target.style.display = "none"}
                  />
                )}
                <div className="text-secondary/60 text-sm mb-2">الإجابة الصحيحة:</div>
                <div data-testid="answer-text" className="text-secondary text-3xl md:text-4xl font-black">
                  {question.answer}
                </div>
              </div>

              {/* Point Assignment */}
              {!pointsAssigned && (
                <div className="mt-8">
                  <div className="text-secondary/70 text-base mb-4">من أجاب صح؟</div>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <button
                      data-testid="assign-team1-btn"
                      onClick={() => handleAssignPoints(1)}
                      className="bg-gradient-to-r from-red-700 to-red-900 border-2 border-red-400/50 text-white px-8 py-3 rounded-full font-bold text-lg hover:scale-105 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all duration-300"
                    >
                      🔴 {session?.team1_name}
                      <span className="block text-sm opacity-80">+{question.difficulty}</span>
                    </button>
                    <button
                      data-testid="assign-team2-btn"
                      onClick={() => handleAssignPoints(2)}
                      className="bg-gradient-to-r from-blue-700 to-blue-900 border-2 border-blue-400/50 text-white px-8 py-3 rounded-full font-bold text-lg hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all duration-300"
                    >
                      🔵 {session?.team2_name}
                      <span className="block text-sm opacity-80">+{question.difficulty}</span>
                    </button>
                    <button
                      data-testid="skip-points-btn"
                      onClick={() => { setPointsAssigned(true); }}
                      className="bg-primary/50 border border-secondary/20 text-secondary/60 px-6 py-3 rounded-full font-bold hover:text-secondary transition-all"
                    >
                      لا أحد
                    </button>
                  </div>
                </div>
              )}

              {pointsAssigned && (
                <div className="mt-6">
                  <button
                    data-testid="continue-btn"
                    onClick={handleBack}
                    className="bg-secondary text-primary px-10 py-3 rounded-full font-black text-lg hover:scale-105 transition-all duration-300"
                  >
                    العودة للوحة ←
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scores */}
      <div className="flex gap-8 mt-6 text-center">
        <div className="text-secondary/50">
          <div className="text-sm">{session?.team1_name}</div>
          <div className="text-2xl font-black text-secondary">{session?.team1_score || 0}</div>
        </div>
        <div className="text-secondary/30 flex items-center">VS</div>
        <div className="text-secondary/50">
          <div className="text-sm">{session?.team2_name}</div>
          <div className="text-2xl font-black text-secondary">{session?.team2_score || 0}</div>
        </div>
      </div>
    </div>
  );
}
