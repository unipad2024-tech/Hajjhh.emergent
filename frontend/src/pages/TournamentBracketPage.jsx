import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { toast } from "sonner";

const PAGE_BG = "radial-gradient(ellipse at 50% -10%, #180012 0%, #0a0008 50%, #050005 100%)";
const GOLD    = "#F1E194";
const CONN    = "rgba(241,225,148,0.2)";
const CONN_STRONG = "rgba(241,225,148,0.45)";

// ── Confetti ────────────────────────────────────────────────────────────────
function fireConfetti(color) {
  const colors = [color || "#F1E194", "#fff", "#FFD700", "#ff6b6b", "#4ecdc4"];
  for (let i = 0; i < 100; i++) {
    const el = document.createElement("div");
    el.style.cssText = `
      position:fixed; pointer-events:none; z-index:9999;
      left:${Math.random() * 100}vw; top:-20px;
      width:${Math.random() * 12 + 4}px; height:${Math.random() * 12 + 4}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      animation:confettiFall ${Math.random() * 3 + 2}s linear ${Math.random() * 1.5}s forwards;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

// ── Match card ────────────────────────────────────────────────────────────────
function MatchCard({ match, teams, isActive, roundIdx, matchIdx, onRecordWinner, onPlay }) {
  const t1 = match.team1;
  const t2 = match.team2;
  const winner = match.winner ? teams.find(t => t.id === match.winner) : null;
  const done = !!match.winner;

  if (match.isBye) {
    const t = t1 || t2;
    return (
      <div
        className="w-full rounded-2xl px-3 py-3 text-center"
        style={{
          background: `${t?.color}12`,
          border: `1px solid ${t?.color}30`,
          minWidth: "190px",
        }}
      >
        <div className="font-black text-sm" style={{ color: t?.color, fontFamily: "Cairo" }}>{t?.name}</div>
        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>تعبئة تلقائية ✓</div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        minWidth: "190px",
        maxWidth: "230px",
        background: done
          ? "rgba(10,5,15,0.85)"
          : isActive
            ? "rgba(80,5,25,0.7)"
            : "rgba(15,5,20,0.7)",
        border: `2px solid ${
          isActive ? CONN_STRONG : done ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"
        }`,
        boxShadow: isActive
          ? `0 0 30px rgba(241,225,148,0.22), 0 0 60px rgba(91,14,20,0.35), inset 0 0 20px rgba(241,225,148,0.04)`
          : done
            ? "0 0 20px rgba(34,197,94,0.12)"
            : "0 4px 16px rgba(0,0,0,0.5)",
        animation: isActive ? "matchPulse 2.5s ease-in-out infinite" : "none",
      }}
    >
      {[t1, t2].map((team, ti) => {
        const isW = done && winner?.id === team?.id;
        const isL = done && winner && !isW;
        return (
          <div
            key={ti}
            className="flex items-center gap-2 px-3 py-2.5 transition-all duration-300"
            style={{
              background: isW ? `${team?.color}20` : "transparent",
              borderBottom: ti === 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}
          >
            {/* Color dot */}
            <div
              className="w-3 h-3 rounded-full shrink-0 transition-all duration-300"
              style={{
                background: team ? (isL ? `${team.color}30` : team.color) : "rgba(255,255,255,0.1)",
                boxShadow: isW ? `0 0 8px ${team?.color}88` : "none",
              }}
            />
            {/* Name */}
            <span
              className="flex-1 font-black text-sm truncate transition-all duration-300"
              style={{
                color: team
                  ? isL
                    ? `${team.color}40`
                    : team.color
                  : "rgba(255,255,255,0.15)",
                fontFamily: "Cairo, sans-serif",
              }}
            >
              {team ? team.name : "TBD"}
            </span>
            {isW && (
              <span
                className="shrink-0 font-black text-sm"
                style={{ color: "#4ade80", textShadow: "0 0 10px rgba(74,222,128,0.6)" }}
              >
                ✓
              </span>
            )}
          </div>
        );
      })}

      {/* Action buttons for active match */}
      {isActive && !done && t1 && t2 && (
        <div
          className="px-2 py-2 border-t space-y-1.5"
          style={{ borderColor: "rgba(241,225,148,0.1)" }}
        >
          <button
            data-testid={`play-match-r${roundIdx}-m${matchIdx}`}
            onClick={onPlay}
            className="w-full py-2 rounded-xl font-black text-xs transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#5B0E14,#9A1E28)",
              color: GOLD,
              border: "1.5px solid rgba(241,225,148,0.3)",
              boxShadow: "0 2px 12px rgba(91,14,20,0.5)",
            }}
          >
            🎮 ابدأ المباراة
          </button>
          <div className="flex gap-1.5">
            {[t1, t2].map(team => (
              <button
                key={team.id}
                data-testid={`winner-${team.id}-r${roundIdx}-m${matchIdx}`}
                onClick={() => onRecordWinner(team.id)}
                className="flex-1 py-1.5 rounded-lg font-black text-xs transition-all hover:scale-105 active:scale-95"
                style={{
                  background: `${team.color}15`,
                  border: `1.5px solid ${team.color}44`,
                  color: team.color,
                }}
              >
                {team.name.length > 7 ? team.name.slice(0, 7) + "…" : team.name} ✓
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Completed label */}
      {done && (
        <div
          className="px-3 py-1.5 text-center text-xs font-black border-t"
          style={{
            borderColor: "rgba(34,197,94,0.15)",
            color: "rgba(74,222,128,0.55)",
          }}
        >
          {winner?.name} تقدّم
        </div>
      )}
    </div>
  );
}

// ── Bracket connector ─────────────────────────────────────────────────────────
function Connector({ leftCount, hasWinner }) {
  const pairs = leftCount / 2;
  return (
    <div className="flex flex-col shrink-0 self-stretch" style={{ width: "36px" }}>
      {Array.from({ length: pairs }).map((_, pi) => (
        <div key={pi} className="flex-1 flex flex-col">
          <div
            className="flex-1 transition-all duration-500"
            style={{
              borderRight: `2px solid ${hasWinner ? CONN_STRONG : CONN}`,
              borderBottom: `2px solid ${hasWinner ? CONN_STRONG : CONN}`,
              borderRadius: "0 0 8px 0",
            }}
          />
          <div
            className="flex-1 transition-all duration-500"
            style={{
              borderRight: `2px solid ${hasWinner ? CONN_STRONG : CONN}`,
              borderTop: `2px solid ${hasWinner ? CONN_STRONG : CONN}`,
              borderRadius: "0 8px 0 0",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Round column ──────────────────────────────────────────────────────────────
function RoundColumn({ round, roundIdx, teams, maxMatches, nextMatch, onRecordWinner, onPlay }) {
  const count = round.matches.length;
  const slotsPerMatch = maxMatches / count;

  return (
    <div className="flex flex-col shrink-0 self-stretch" style={{ width: "215px" }}>
      {/* Round header */}
      <div className="h-10 flex items-center justify-center shrink-0">
        <span
          className="px-4 py-1 rounded-full font-black text-xs tracking-wide"
          style={{
            background: "rgba(241,225,148,0.06)",
            color: "rgba(241,225,148,0.6)",
            border: "1px solid rgba(241,225,148,0.18)",
            fontFamily: "Cairo, sans-serif",
          }}
        >
          {round.name}
        </span>
      </div>

      {/* Match slots */}
      <div className="flex-1 flex flex-col">
        {round.matches.map((match, mi) => {
          const isActive = nextMatch?.roundIdx === roundIdx && nextMatch?.matchIdx === mi;
          return (
            <div
              key={match.id}
              className="flex items-center justify-center px-1 py-1.5"
              style={{ flex: slotsPerMatch, minHeight: `${Math.max(75, 280 / count)}px` }}
            >
              <MatchCard
                match={match}
                teams={teams}
                isActive={isActive}
                roundIdx={roundIdx}
                matchIdx={mi}
                onRecordWinner={(wid) => onRecordWinner(roundIdx, mi, wid)}
                onPlay={() => onPlay(match, roundIdx, mi)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TournamentBracketPage() {
  const navigate = useNavigate();
  const location  = useLocation();
  const { tournamentState, updateTournament, setGameMode, createSession, resetGame } = useGame();
  const [loading, setLoading] = useState(false);
  const [champFired, setChampFired] = useState(false);

  // Auto-record winner when returning from a match
  useEffect(() => {
    const ar = location.state?.autoRecord;
    if (ar && tournamentState) {
      // Delay slightly to let state settle
      setTimeout(() => {
        recordWinner(ar.roundIdx, ar.matchIdx, ar.winnerId);
        navigate(location.pathname, { replace: true, state: {} });
      }, 100);
    }
  }, []); // eslint-disable-line

  const { teams, rounds, champion } = tournamentState || {};
  const champTeam = champion && teams ? teams.find(t => t.id === champion) : null;
  const maxMatches = rounds?.[0]?.matches.length || 1;

  // Champion confetti
  useEffect(() => {
    if (champTeam && !champFired) {
      setChampFired(true);
      fireConfetti(champTeam.color);
    }
  }, [champTeam, champFired]);

  if (!tournamentState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: PAGE_BG }}>
        <div className="text-center">
          <div className="text-secondary/50 mb-4 font-bold text-lg" style={{ fontFamily: "Cairo" }}>
            لا توجد بطولة نشطة
          </div>
          <button
            onClick={() => navigate("/tournament")}
            className="bg-secondary text-primary px-8 py-3 rounded-full font-black text-lg hover:scale-105 transition-all"
          >
            إنشاء بطولة
          </button>
        </div>
      </div>
    );
  }

  const findNextPendingMatch = () => {
    for (let ri = 0; ri < rounds.length; ri++) {
      const prevDone = ri === 0 || rounds[ri - 1].matches.every(m => !!m.winner);
      if (!prevDone) break;
      for (let mi = 0; mi < rounds[ri].matches.length; mi++) {
        const m = rounds[ri].matches[mi];
        if (!m.winner && !m.isBye && m.team1 && m.team2) return { roundIdx: ri, matchIdx: mi };
      }
    }
    return null;
  };

  const recordWinner = (roundIdx, matchIdx, winnerId) => {
    updateTournament(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const match = next.rounds[roundIdx].matches[matchIdx];
      if (match.winner) return prev; // already recorded
      match.winner = winnerId;

      if (roundIdx + 1 < next.rounds.length) {
        const slotIdx = Math.floor(matchIdx / 2);
        const nextM = next.rounds[roundIdx + 1].matches[slotIdx];
        const winnerObj = next.teams.find(t => t.id === winnerId);
        if (matchIdx % 2 === 0) nextM.team1 = winnerObj;
        else nextM.team2 = winnerObj;
      } else {
        next.champion = winnerId;
      }
      return next;
    });
    const wName = teams.find(t => t.id === winnerId)?.name;
    toast.success(`🏆 ${wName} يتقدم!`, { duration: 2000 });
  };

  const handlePlayMatch = async (match, roundIdx, matchIdx) => {
    if (!match.team1 || !match.team2 || loading) return;
    setLoading(true);
    try {
      setGameMode("tournament");
      resetGame();
      updateTournament(prev => ({
        ...prev,
        currentMatchRef: {
          roundIdx,
          matchIdx,
          team1Id: match.team1.id,
          team2Id: match.team2.id,
        },
      }));
      await createSession(match.team1.name, match.team2.name);
      navigate("/categories");
    } catch {
      toast.error("حدث خطأ، حاول مرة ثانية");
    } finally {
      setLoading(false);
    }
  };

  const nextMatch = findNextPendingMatch();
  const nextMatchData = nextMatch ? rounds[nextMatch.roundIdx].matches[nextMatch.matchIdx] : null;
  const completedRounds = rounds.filter(r => r.matches.every(m => !!m.winner)).length;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: PAGE_BG }}
    >
      {/* ── Keyframes injected once ── */}
      <style>{`
        @keyframes matchPulse {
          0%, 100% { box-shadow: 0 0 30px rgba(241,225,148,0.22), 0 0 60px rgba(91,14,20,0.35), inset 0 0 20px rgba(241,225,148,0.04); }
          50%       { box-shadow: 0 0 50px rgba(241,225,148,0.38), 0 0 80px rgba(91,14,20,0.5), inset 0 0 30px rgba(241,225,148,0.08); }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes champGlow {
          0%, 100% { text-shadow: 0 0 40px currentColor, 0 0 80px currentColor; }
          50%       { text-shadow: 0 0 70px currentColor, 0 0 140px currentColor; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Header ── */}
      <div
        className="shrink-0 px-4 py-3 flex items-center justify-between border-b"
        style={{ background: "rgba(0,0,0,0.55)", borderColor: "rgba(241,225,148,0.08)" }}
      >
        <button
          onClick={() => navigate("/tournament")}
          className="text-secondary/40 hover:text-secondary/70 transition-colors font-bold text-sm"
        >
          ← بطولة جديدة
        </button>
        <h1
          className="text-xl font-black text-secondary flex items-center gap-2"
          style={{ fontFamily: "Cairo, sans-serif" }}
        >
          <span>🏆</span>
          <span>جدول البطولة</span>
        </h1>
        <button
          onClick={() => navigate("/")}
          className="text-secondary/30 hover:text-secondary/60 transition-colors font-bold text-xs"
        >
          الرئيسية
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div data-testid="bracket-progress" className="shrink-0 h-1" style={{ background: "rgba(241,225,148,0.06)" }}>
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${(completedRounds / rounds.length) * 100}%`,
            background: "linear-gradient(90deg, #5B0E14, #F1E194)",
          }}
        />
      </div>

      {/* ── Next match banner ── */}
      {nextMatchData && !champion && (
        <div
          data-testid="next-match-banner"
          className="shrink-0 px-4 py-2.5 text-center border-b"
          style={{
            background: "rgba(91,14,20,0.22)",
            borderColor: "rgba(241,225,148,0.08)",
            animation: "slideUp 0.4s ease-out",
          }}
        >
          <span
            className="font-black text-sm"
            style={{ color: "rgba(241,225,148,0.75)", fontFamily: "Cairo" }}
          >
            {rounds[nextMatch.roundIdx].name} ·{" "}
            <span style={{ color: nextMatchData.team1?.color }}>{nextMatchData.team1?.name}</span>
            <span style={{ color: "rgba(241,225,148,0.35)" }}> ضد </span>
            <span style={{ color: nextMatchData.team2?.color }}>{nextMatchData.team2?.name}</span>
          </span>
        </div>
      )}

      {/* ── Bracket (horizontal scroll) ── */}
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden flex items-center justify-center py-4 px-6"
        dir="ltr"
      >
        <div
          className="flex items-stretch"
          style={{ minHeight: "440px", height: "calc(100% - 16px)", gap: "0" }}
        >
          {rounds.map((round, ri) => {
            const roundComplete = round.matches.every(m => !!m.winner);
            return (
              <React.Fragment key={ri}>
                <RoundColumn
                  round={round}
                  roundIdx={ri}
                  teams={teams}
                  maxMatches={maxMatches}
                  nextMatch={nextMatch}
                  onRecordWinner={recordWinner}
                  onPlay={handlePlayMatch}
                />
                {ri < rounds.length - 1 && (
                  <Connector leftCount={round.matches.length} hasWinner={roundComplete} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="shrink-0 px-4 py-3 text-center border-t"
        style={{ background: "rgba(0,0,0,0.45)", borderColor: "rgba(241,225,148,0.06)" }}
      >
        <div className="text-secondary/30 text-xs font-bold">
          {rounds.reduce((a, r) => a + r.matches.filter(m => !!m.winner && !m.isBye).length, 0)} مباراة مكتملة ·{" "}
          {rounds.reduce((a, r) => a + r.matches.filter(m => !m.winner && !m.isBye && m.team1 && m.team2).length, 0)} متبقية
        </div>
      </div>

      {/* ── Champion overlay ── */}
      {champTeam && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center z-50 px-8 text-center"
          style={{ background: "radial-gradient(ellipse at center, rgba(20,0,30,0.97) 0%, rgba(0,0,0,0.99) 100%)" }}
        >
          <div
            className="text-9xl mb-6"
            style={{ animation: "bounce 1s ease-in-out infinite" }}
          >
            🏆
          </div>
          <div className="text-secondary/50 font-bold text-base mb-3" style={{ fontFamily: "Cairo" }}>
            بطل البطولة
          </div>
          <div
            className="text-5xl md:text-7xl font-black mb-2"
            style={{
              color: champTeam.color,
              fontFamily: "Cairo, sans-serif",
              animation: "champGlow 2s ease-in-out infinite",
            }}
          >
            {champTeam.name}
          </div>
          <div className="text-secondary/35 text-sm mb-10">مبروك 🎉</div>

          {/* Team scoreboard */}
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            {rounds[rounds.length - 1]?.matches[0] && (() => {
              const finalMatch = rounds[rounds.length - 1].matches[0];
              return [finalMatch.team1, finalMatch.team2].map(t => t && (
                <div
                  key={t.id}
                  className="rounded-2xl px-5 py-3 text-center"
                  style={{
                    background: t.id === champTeam.id ? `${t.color}22` : "rgba(0,0,0,0.4)",
                    border: `2px solid ${t.id === champTeam.id ? t.color : t.color + "33"}`,
                    boxShadow: t.id === champTeam.id ? `0 0 30px ${t.color}44` : "none",
                  }}
                >
                  <div className="font-black mb-1" style={{ color: t.color }}>{t.name}</div>
                  {t.id === champTeam.id && (
                    <div style={{ color: GOLD, fontSize: "1.5rem" }}>🥇</div>
                  )}
                </div>
              ));
            })()}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigate("/tournament")}
              className="bg-secondary text-primary px-8 py-3 rounded-full font-black text-lg hover:scale-105 transition-all shadow-2xl"
            >
              بطولة جديدة
            </button>
            <button
              onClick={() => navigate("/")}
              className="border-2 text-secondary/60 px-8 py-3 rounded-full font-bold hover:text-secondary/90 transition-all"
              style={{ borderColor: "rgba(241,225,148,0.25)" }}
            >
              الرئيسية
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
