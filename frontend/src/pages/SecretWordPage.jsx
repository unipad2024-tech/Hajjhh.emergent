import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;


export default function SecretWordPage() {
  const { questionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios.get(`${API}/secret/${questionId}`)
      .then(({ data }) => { setData(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [questionId]);

  if (loading) return (
    <div className="min-h-screen game-board-bg flex items-center justify-center">
      <div className="text-secondary text-2xl animate-pulse">جاري التحميل...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen game-board-bg flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">❌</div>
        <div className="text-secondary text-2xl font-bold">رابط غير صحيح</div>
        <div className="text-secondary/60 text-lg mt-2">هذا الرابط لا يعمل</div>
      </div>
    </div>
  );

  const difficultyLabel = data.difficulty === 200 ? "سهل" : data.difficulty === 400 ? "متوسط" : "صعب";
  const difficultyColor = data.difficulty === 200 ? "text-green-400" : data.difficulty === 400 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-studio">
      <div className="text-center animate-scale-in max-w-sm w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="text-secondary text-5xl font-black mb-2">🤫</div>
          <div className="text-secondary/60 text-lg">هذي كلمتك السرية</div>
          <div className={`text-sm font-bold mt-1 ${difficultyColor}`}>{difficultyLabel}</div>
        </div>

        {/* Secret Word Card */}
        <div className="bg-secondary rounded-3xl p-10 shadow-[0_0_60px_rgba(241,225,148,0.3)] border-4 border-secondary">
          {data.image_url && (
            <img
              src={data.image_url}
              alt="secret"
              data-testid="secret-image"
              className="mx-auto mb-6 max-h-40 object-contain rounded-xl"
              onError={(e) => e.target.style.display = "none"}
            />
          )}
          <div
            data-testid="secret-word"
            className="text-primary text-5xl font-black leading-tight"
          >
            {data.word}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-primary/50 border border-secondary/20 rounded-2xl p-4 text-right">
          <div className="text-secondary font-bold mb-2">التعليمات:</div>
          <ul className="text-secondary/70 text-sm space-y-1 list-none">
            <li>• وصّف الكلمة لفريقك بدون ما تقولها</li>
            <li>• ما يجوز تقول أي حرف منها</li>
            <li>• ما يجوز تمثّلها بالحركات</li>
          </ul>
        </div>

        <div className="mt-4 text-secondary/30 text-xs">
          لعبة حُجّة – ولا كلمة
        </div>
      </div>
    </div>
  );
}
