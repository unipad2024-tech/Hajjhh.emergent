import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { toast } from "sonner";

const DARK_BG = { background: "radial-gradient(ellipse at top, #3D0810 0%, #1a0205 40%, #0f0102 100%)" };

function getTeamById(teams, id) {
  return teams?.find(t => t.id === id) || null;
}

function MatchCard({ match, teams, roundIdx, matchIdx, onRecordWinner, canPlay, onPlay }) {
  const t1 = match.team1;
  const t2 = match.team2;
  const winner = match.winner ? getTeamById(teams, match.winner) : null;
  const isCompleted = !!match.winner;
  const isBye = match.isBye;

  return (
    <div
      className="rounded-2xl p-3 border transition-all"
      style={{
        background: isCompleted ? "rgba(34,197,94,0.07)" : canPlay ? "rgba(91,14,20,0.25)" : "rgba(28,28,28,0.4)",
        borderColor: isCompleted ? "rgba(34,197,94,0.35)" : canPlay ? "rgba(241,225,148,0.3)" : "rgba(255,255,255,0.08)",
        boxShadow: canPlay ? "0 0 20px rgba(91,14,20,0.4)" : "none",
      }}
    >
      {isBye ? (
        <div className="text-center py-1">
          <span
            className="font-black text-sm"
            style={{ color: (t1 || t2)?.color || "#F1E194" }}
          >
            {(t1 || t2)?.name} — تعبئة تلقائية ✓
          </span>
        </div>
      ) : (
        <>
          {/* Teams */}
          <div className="space-y-1.5 mb-2">
            {[t1, t2].map((team, ti) => (
              <div
                key={ti}
                className="flex items-center justify-between px-2 py-1.5 rounded-xl"
                style={{
                  background: winner?.id === team?.id ? `${team?.color}22` : "rgba(0,0,0,0.2)",
                  border: `1.5px solid ${winner?.id === team?.id ? team?.color + "66" : "transparent"}`,
                }}
              >
                <span
                  className="font-black text-sm"
                  style={{ color: team?.color || "rgba(241,225,148,0.4)" }}
                >
                  {team ? team.name : "TBD"}
                </span>
                {winner?.id === team?.id && <span className="text-green-400 font-black text-sm">✓</span>}
              </div>
            ))}
          </div>

          {/* Actions */}
          {!isCompleted && canPlay && t1 && t2 && (
            <div className="space-y-1.5">
              <button
                data-testid={`play-match-r${roundIdx}-m${matchIdx}`}
                onClick={() => onPlay(match)}
                className="w-full py-2 rounded-xl font-black text-sm transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg,#5B0E14,#8B1520)",
                  color: "#F1E194",
                  border: "1.5px solid rgba(241,225,148,0.35)",
                }}
              >
                🎮 ابدأ المباراة
              </button>
              {/* Manual winner buttons */}
              <div className="flex gap-1.5">
                {[t1, t2].map((team) => (
                  <button
                    key={team.id}
                    data-testid={`winner-${team.id}-r${roundIdx}-m${matchIdx}`}
                    onClick={() => onRecordWinner(roundIdx, matchIdx, team.id)}
                    className="flex-1 py-1.5 rounded-xl font-black text-xs transition-all hover:scale-105"
                    style={{
                      background: `${team.color}18`,
                      border: `1.5px solid ${team.color}44`,
                      color: team.color,
                    }}
                  >
                    فاز {team.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isCompleted && (
            <div
              className="text-center py-1 text-xs font-black"
              style={{ color: "rgba(34,197,94,0.7)" }}
            >
              ✓ {winner?.name}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TournamentBracketPage() {
  const navigate = useNavigate();
  const { tournamentState, updateTournament, setGameMode, createSession, resetGame } = useGame();
  const [loading, setLoading] = useState(false);

  if (!tournamentState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={DARK_BG}>
        <div className="text-center">
          <p className="text-secondary/60 mb-4">لا توجد بطولة نشطة</p>
          <button
            onClick={() => navigate("/tournament")}
            className="bg-secondary text-primary px-6 py-3 rounded-full font-black hover:scale-105 transition-all"
          >
            إنشاء بطولة
          </button>
        </div>
      </div>
    );
  }

  const { teams, rounds, champion } = tournamentState;

  // Find the first pending match across rounds in order
  const findNextPendingMatch = () => {
    for (let ri = 0; ri < rounds.length; ri++) {
      const round = rounds[ri];
      // Check all previous rounds are complete
      const prevComplete = ri === 0 || rounds[ri - 1].matches.every(m => !!m.winner);
      if (!prevComplete) break;
      for (let mi = 0; mi < round.matches.length; mi++) {
        const m = round.matches[mi];
        if (!m.winner && !m.isBye && m.team1 && m.team2) {
          return { roundIdx: ri, matchIdx: mi };
        }
      }
    }
    return null;
  };

  const nextMatch = findNextPendingMatch();

  const recordWinner = (roundIdx, matchIdx, winnerId) => {
    updateTournament(prev => {
      const next = JSON.parse(JSON.stringify(prev)); // deep clone
      const match = next.rounds[roundIdx].matches[matchIdx];
      match.winner = winnerId;

      // Advance winner to next round
      if (roundIdx + 1 < next.rounds.length) {
        const nextRound = next.rounds[roundIdx + 1];
        const slotIdx = Math.floor(matchIdx / 2);
        if (matchIdx % 2 === 0) {
          nextRound.matches[slotIdx].team1 = next.teams.find(t => t.id === winnerId);
        } else {
          nextRound.matches[slotIdx].team2 = next.teams.find(t => t.id === winnerId);
        }
      } else {
        // Final match completed
        next.champion = winnerId;
      }
      return next;
    });
    const winnerTeam = teams.find(t => t.id === winnerId);
    toast.success(`🏆 ${winnerTeam?.name} تقدم للجولة التالية!`, { duration: 2000 });
  };

  const handlePlayMatch = async (match) => {
    if (!match.team1 || !match.team2) return;
    setLoading(true);
    try {
      setGameMode("tournament");
      resetGame();
      await createSession(match.team1.name, match.team2.name);
      navigate("/categories");
    } catch {
      toast.error("حدث خطأ، حاول مرة ثانية");
    } finally {
      setLoading(false);
    }
  };

  const champTeam = champion ? teams.find(t => t.id === champion) : null;

  return (
    <div className="min-h-screen flex flex-col" style={DARK_BG}>
      {/* Header */}
      <div
        className="shrink-0 px-4 py-3 border-b flex items-center justify-between"
        style={{ background: "rgba(91,14,20,0.3)", borderColor: "rgba(241,225,148,0.15)" }}
      >
        <button
          onClick={() => navigate("/tournament")}
          className="text-secondary/50 hover:text-secondary transition-colors font-bold text-sm"
        >
          ← جديد
        </button>
        <h1
          className="text-xl font-black text-secondary"
          style={{ fontFamily: "Cairo, sans-serif" }}
        >
          🏆 جدول البطولة
        </h1>
        <button
          onClick={() => navigate("/")}
          className="text-secondary/40 hover:text-secondary/70 transition-colors font-bold text-xs"
        >
          الرئيسية
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Champion Banner */}
        {champTeam && (
          <div
            className="rounded-3xl p-6 mb-6 text-center border-2"
            style={{
              background: `${champTeam.color}20`,
              borderColor: champTeam.color,
              boxShadow: `0 0 40px ${champTeam.color}44`,
            }}
          >
            <div className="text-5xl mb-2">🏆</div>
            <div className="text-secondary/60 text-sm mb-1">بطل البطولة</div>
            <div
              className="text-4xl font-black"
              style={{ color: champTeam.color, fontFamily: "Cairo" }}
            >
              {champTeam.name}
            </div>
          </div>
        )}

        {/* Next match call-to-action */}
        {!champion && nextMatch && (
          <div
            className="rounded-2xl p-4 mb-6 border-2 text-center"
            style={{ background: "rgba(91,14,20,0.2)", borderColor: "rgba(241,225,148,0.3)" }}
          >
            <div className="text-secondary/60 text-xs mb-1">المباراة القادمة</div>
            <div className="text-secondary font-black text-lg">
              {rounds[nextMatch.roundIdx].matches[nextMatch.matchIdx].team1?.name}
              {" "}<span className="text-secondary/40">VS</span>{" "}
              {rounds[nextMatch.roundIdx].matches[nextMatch.matchIdx].team2?.name}
            </div>
            <div className="text-secondary/40 text-xs mt-0.5">{rounds[nextMatch.roundIdx].name}</div>
          </div>
        )}

        {/* Rounds */}
        <div className="space-y-6">
          {rounds.map((round, ri) => {
            const prevComplete = ri === 0 || rounds[ri - 1].matches.every(m => !!m.winner);
            return (
              <div key={ri}>
                {/* Round header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px" style={{ background: "rgba(241,225,148,0.15)" }} />
                  <span
                    className="font-black px-3 py-1 rounded-full text-sm"
                    style={{
                      background: prevComplete ? "rgba(91,14,20,0.4)" : "rgba(0,0,0,0.3)",
                      color: prevComplete ? "#F1E194" : "rgba(241,225,148,0.3)",
                      border: `1px solid ${prevComplete ? "rgba(241,225,148,0.3)" : "rgba(241,225,148,0.1)"}`,
                    }}
                  >
                    {round.name}
                  </span>
                  <div className="flex-1 h-px" style={{ background: "rgba(241,225,148,0.15)" }} />
                </div>

                {/* Matches grid */}
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%,260px), 1fr))" }}
                >
                  {round.matches.map((match, mi) => {
                    const isNext = nextMatch?.roundIdx === ri && nextMatch?.matchIdx === mi;
                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        teams={teams}
                        roundIdx={ri}
                        matchIdx={mi}
                        canPlay={prevComplete && isNext}
                        onRecordWinner={recordWinner}
                        onPlay={handlePlayMatch}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* New tournament button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/tournament")}
            className="border border-secondary/20 text-secondary/40 px-6 py-3 rounded-full font-bold text-sm hover:text-secondary/70 hover:border-secondary/40 transition-all"
          >
            بطولة جديدة
          </button>
        </div>

      </div>
    </div>
  );
}
