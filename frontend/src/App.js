import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider } from "@/context/GameContext";
import { Toaster } from "sonner";

import HomePage from "@/pages/HomePage";
import TeamSetupPage from "@/pages/TeamSetupPage";
import CategorySelectPage from "@/pages/CategorySelectPage";
import GameBoardPage from "@/pages/GameBoardPage";
import QuestionPage from "@/pages/QuestionPage";
import SecretWordPage from "@/pages/SecretWordPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminDashboard from "@/pages/AdminDashboard";

function App() {
  return (
    <GameProvider>
      <div className="App" dir="rtl">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/setup" element={<TeamSetupPage />} />
            <Route path="/categories" element={<CategorySelectPage />} />
            <Route path="/game" element={<GameBoardPage />} />
            <Route path="/question" element={<QuestionPage />} />
            <Route path="/secret/:questionId" element={<SecretWordPage />} />
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </div>
    </GameProvider>
  );
}

export default App;
