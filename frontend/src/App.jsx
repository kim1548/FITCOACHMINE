// src/App.jsx
import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TopNavbar from "./components/TopNavbar";
import BottomNav from "./components/BottomNav";
import SettingsDrawer from "./components/SettingsDrawer";
import ReminderScheduler from "./components/ReminderScheduler";
import DietPage from "./pages/DietPage";
import JournalPage from "./pages/JournalPage";
import BodyPage from "./pages/BodyPage";
import CommunityPage from "./pages/CommunityPage";
import SupplementPage from "./pages/SupplementPage";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import { ConfirmProvider } from "./components/ui/ConfirmProvider";
import DietAddPage from './pages/DietAddPage';
import RoutinePlaySelectPage from "./pages/RoutinePlaySelectPage";
import RoutinePlayPage from "./pages/RoutinePlayPage";
import RoutinePlanPage from "./pages/RoutinePlanPage";
import ProgramPlayPage from "./pages/ProgramPlayPage";
import WorkoutSummary from "./pages/WorkoutSummary";

// 루트 경로 분기 — 로그인된 사용자는 /journal, 비로그인은 Landing.
const RootRoute = () => {
  const { user } = useAuth();
  if (user) return <Navigate to="/journal" replace />;
  return <Landing />;
};

const AppContent = () => {
  const [theme, setTheme] = useState("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Routes>
      {/* 1. 인증 / 표지 — TopNavbar 없는 깨끗한 화면 (Landing 은 자체 슬라이드인 헤더) */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<RootRoute />} />

      {/* 2. 메인 서비스 영역 — TopNavbar 가 글로벌 마스트헤드 + 탭 모두 담당 */}
      <Route
        path="*"
        element={
          <div className="fixed inset-0 bg-surface text-ink flex flex-col overflow-hidden">
            <ReminderScheduler />
            <TopNavbar onOpenSettings={() => setSettingsOpen(true)} />
            <main className="flex-1 relative overflow-hidden flex justify-center">
              <Routes>
                {/* 루틴 계획 */}
                <Route path="/program" element={<RoutinePlanPage theme={theme} />} />
                <Route path="/program/play" element={<ProgramPlayPage theme={theme} />} />
                <Route path="/program/summary" element={<WorkoutSummary theme={theme} />} />

                {/* Form Check (AI 자세 분석) */}
                <Route path="/formcheck" element={<RoutinePlaySelectPage theme={theme} />} />
                <Route path="/formcheck/:exId" element={<RoutinePlayPage theme={theme} />} />

                <Route path="/meals" element={<DietPage theme={theme} />} />
                <Route path="/meals/add" element={<DietAddPage />} />
                <Route path="/journal" element={<JournalPage theme={theme} />} />
                <Route path="/body" element={<BodyPage theme={theme} />} />
                <Route path="/community" element={<CommunityPage theme={theme} />} />
                <Route path="/supplement" element={<SupplementPage theme={theme} />} />
              </Routes>
            </main>
            <BottomNav />
            <SettingsDrawer
              isOpen={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              theme={theme}
              setTheme={setTheme}
            />
          </div>
        }
      />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <AppContent />
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
