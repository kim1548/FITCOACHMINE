import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/ConfirmProvider";
import { requestNotifPermission, showLocalNotification } from "../utils/notify";

/**
 * Settings 패널 — Editorial Magazine 톤.
 * SettingsDrawer 안에 들어가므로 외곽 헤더는 drawer 가 담당.
 */
const DEFAULT_TIMES = { workout: "19:00", breakfast: "08:00", lunch: "12:30", dinner: "19:00" };

const loadNotifPrefs = () => {
  try { return JSON.parse(localStorage.getItem("notif_prefs") || "{}"); }
  catch { return {}; }
};

const loadNotifTimes = () => {
  try { return { ...DEFAULT_TIMES, ...JSON.parse(localStorage.getItem("notif_times") || "{}") }; }
  catch { return DEFAULT_TIMES; }
};

const timeInputCls =
  "px-3 py-2 bg-bone rounded-[10px] border border-ink/10 focus:border-lilac-deep focus:bg-paper outline-none font-sans text-[0.8125rem] text-ink tabular-nums transition-colors";

const Settings = ({ theme, setTheme }) => {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [notif, setNotif] = useState(loadNotifPrefs);
  const [times, setTimes] = useState(loadNotifTimes);

  // 닉네임 수정 — 기본은 버튼만, 누르면 입력칸이 펼쳐진다. (아바타는 상단 AvatarMenu 에서)
  const [editingNick, setEditingNick] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [savingNick, setSavingNick] = useState(false);

  useEffect(() => {
    setNickname(user?.nickname || "");
  }, [user?.nickname]);

  const handleSaveNickname = async () => {
    setSavingNick(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.patch(
        `${API_BASE_URL}/user/me`,
        { nickname: nickname.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateProfile({ nickname: res.data.nickname });
      toast.success("닉네임을 저장했습니다.");
      setEditingNick(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "닉네임 저장에 실패했습니다.");
    } finally {
      setSavingNick(false);
    }
  };

  const toggleNotif = async (key) => {
    const turningOn = !notif[key];
    if (turningOn) {
      const perm = await requestNotifPermission();
      if (perm === "denied") {
        toast.error("브라우저 알림 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요.");
      }
    }
    setNotif((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("notif_prefs", JSON.stringify(next));
      return next;
    });
  };

  const setTime = (key) => (e) => {
    setTimes((prev) => {
      const next = { ...prev, [key]: e.target.value };
      localStorage.setItem("notif_times", JSON.stringify(next));
      return next;
    });
  };

  // 공유용 HWA 링크 — public/app-link.txt(터널 주소)를 우선 사용하고, 없으면 현재 접속 주소로 폴백.
  // 터널이 바뀌면 app-link.txt 한 줄만 고치면 됨(재빌드 불필요).
  const [appLink, setAppLink] = useState(typeof window !== "undefined" ? window.location.origin : "");
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/app-link.txt", { cache: "no-store" })
        .then((r) => (r.ok ? r.text() : ""))
        .then((t) => {
          const url = (t || "").replace(/^﻿/, "").trim();
          if (alive && /^https?:\/\/\S+$/.test(url)) setAppLink(url);
        })
        .catch(() => {});
    };
    load();
    // 터널이 재발급돼 app-link.txt 가 바뀌면 새로고침 없이 자동 반영 (30초 간격)
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(appLink);
      toast.success("링크를 복사했습니다.");
    } catch {
      toast.error("복사하지 못했습니다.");
    }
  };

  const handleStoreSoon = (store) => {
    toast.success(`${store} — 곧 만나요! 🙌`);
  };

  const handleTestNotif = async () => {
    const perm = await requestNotifPermission();
    if (perm !== "granted") {
      toast.error("알림 권한을 허용해 주세요.");
      return;
    }
    const ok = await showLocalNotification("FitCoach 테스트 알림 🔔", "알림이 정상적으로 동작합니다!");
    if (ok) toast.success("테스트 알림을 보냈습니다.");
    else toast.error("알림을 표시하지 못했습니다.");
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: "정말 탈퇴하시겠습니까?",
      description: "계정과 함께 모든 운동·식단·저널 기록이 영구 삭제되며 복구할 수 없습니다.",
      confirmLabel: "Delete account",
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("회원 탈퇴가 완료되었습니다.");
      logout();
      navigate("/signup", { replace: true });
    } catch (err) {
      toast.error("탈퇴 실패: " + (err?.response?.data?.detail || "알 수 없는 오류"));
      setDeleting(false);
    }
  };

  const SectionLabel = ({ children, accent = "red" }) => (
    <div className="mb-3">
      <span className="inline-block bg-bone border border-ink/10 rounded-[10px] px-2.5 py-1 font-sans text-[0.72rem] font-medium tracking-wide text-ink">
        {children}
      </span>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* 1. Nickname — 기본은 버튼만, 누르면 입력칸 펼침 */}
      <section>
        {!editingNick ? (
          <button
            onClick={() => { setNickname(user?.nickname || ""); setEditingNick(true); }}
            className="font-sans text-[0.8125rem] text-taupe hover:text-ink transition-colors"
          >
            닉네임 수정
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="커뮤니티 표시 이름"
                className="flex-1 min-w-0 px-3 py-2 bg-bone rounded-[10px] border border-ink/10 focus:border-lilac-deep focus:bg-paper outline-none font-sans text-[0.875rem] text-ink placeholder:text-hint transition-colors"
              />
              <button
                onClick={handleSaveNickname}
                disabled={savingNick}
                className="shrink-0 font-sans text-[0.8125rem] text-ink hover:text-lilac-deep transition-colors disabled:opacity-50"
              >
                {savingNick ? "저장중" : "저장"}
              </button>
              <button
                onClick={() => setEditingNick(false)}
                className="shrink-0 font-sans text-[0.8125rem] text-taupe hover:text-ink transition-colors"
              >
                취소
              </button>
            </div>
            <p className="font-sans text-[0.6875rem] text-hint leading-relaxed">
              비워두면 아이디 일부만 표시됩니다.
            </p>
          </div>
        )}
      </section>

      {/* 2. Notifications */}
      <section>
        <SectionLabel>Notifications</SectionLabel>
        <div className="border border-ink/10 rounded-[16px] divide-y divide-ink/8">
          {/* 운동 루틴 알림 */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-sans text-[0.9375rem] text-ink leading-tight">운동 루틴 알림</p>
                <p className="font-sans text-[0.6875rem] text-taupe mt-1 leading-relaxed">
                  정해진 시간에 운동 시작 알람을 받습니다.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={!!notif.workout}
                aria-label="운동 루틴 알림"
                onClick={() => toggleNotif("workout")}
                className={`flex-shrink-0 w-10 h-5 relative rounded-full transition-colors ${
                  notif.workout ? "bg-lilac" : "bg-ink/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    notif.workout ? "right-0.5 bg-paper" : "left-0.5 bg-taupe"
                  }`}
                />
              </button>
            </div>
            {notif.workout && (
              <div className="mt-3 flex items-center gap-2">
                <span className="font-sans text-[0.6875rem] text-taupe">시간</span>
                <input type="time" value={times.workout} onChange={setTime("workout")} className={timeInputCls} />
              </div>
            )}
          </div>

          {/* 식사 기록 리마인드 */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-sans text-[0.9375rem] text-ink leading-tight">식사 기록 리마인드</p>
                <p className="font-sans text-[0.6875rem] text-taupe mt-1 leading-relaxed">
                  매 끼니 식단 기록을 잊지 않도록 알려줍니다.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={!!notif.meal}
                aria-label="식사 기록 리마인드"
                onClick={() => toggleNotif("meal")}
                className={`flex-shrink-0 w-10 h-5 relative rounded-full transition-colors ${
                  notif.meal ? "bg-lilac" : "bg-ink/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    notif.meal ? "right-0.5 bg-paper" : "left-0.5 bg-taupe"
                  }`}
                />
              </button>
            </div>
            {notif.meal && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[["breakfast", "아침"], ["lunch", "점심"], ["dinner", "저녁"]].map(([k, lbl]) => (
                  <div key={k}>
                    <span className="block font-sans text-[0.625rem] text-taupe mb-1">{lbl}</span>
                    <input type="time" value={times[k]} onChange={setTime(k)} className={`w-full ${timeInputCls}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-2">
          <button
            onClick={handleTestNotif}
            className="font-sans text-[0.8125rem] text-ink hover:text-lilac-deep transition-colors"
          >
            테스트 알림
          </button>
        </div>
      </section>

      {/* 2.5 Get the app */}
      <section>
        <SectionLabel>Get the app</SectionLabel>
        <div className="border border-ink/10 rounded-[16px] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <a
              href={appLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0 font-sans text-[0.75rem] text-lilac-deep hover:text-ink underline underline-offset-2 break-all transition-colors"
            >
              {appLink}
            </a>
            <button
              onClick={copyLink}
              className="shrink-0 font-sans text-[0.8125rem] text-taupe hover:text-ink transition-colors"
            >
              복사
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Google Play */}
            <button
              onClick={() => handleStoreSoon("Google Play")}
              aria-label="Get it on Google Play"
              className="flex items-center gap-2.5 bg-black border border-white/15 rounded-lg px-3 py-2 hover:border-white/35 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0 fill-white" aria-hidden="true">
                <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.114l11.04 10.908zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
              </svg>
              <div className="text-left leading-none">
                <div className="text-[0.4375rem] text-white/70 tracking-wide uppercase">Get it on</div>
                <div className="text-[0.8125rem] text-white leading-tight">Google Play</div>
              </div>
            </button>

            {/* App Store */}
            <button
              onClick={() => handleStoreSoon("App Store")}
              aria-label="Download on the App Store"
              className="flex items-center gap-2.5 bg-black border border-white/15 rounded-lg px-3 py-2 hover:border-white/35 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0 fill-white" aria-hidden="true">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zm3.378-3.066c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
              </svg>
              <div className="text-left leading-none">
                <div className="text-[0.4375rem] text-white/70 tracking-wide uppercase">Download on the</div>
                <div className="text-[0.8125rem] text-white leading-tight">App Store</div>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Account */}
      <section>
        <SectionLabel accent="gold">Account</SectionLabel>
        <button
          onClick={handleLogout}
          className="w-full text-left px-5 py-4 border border-ink/10 rounded-[16px] hover:border-ink/25 hover:bg-ink/[0.03] transition-colors mb-3"
        >
          <p className="font-sans text-[0.875rem] text-ink">
            Logout
          </p>
          <p className="font-sans text-[0.75rem] text-hint mt-1.5 leading-relaxed">
            이 기기에서 로그아웃합니다.
          </p>
        </button>
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="w-full text-left px-5 py-5 border border-[#c43c2f]/30 rounded-[16px] text-[#c43c2f] hover:bg-[#c43c2f]/5 transition-colors group disabled:opacity-50"
        >
          <p className="font-sans text-[0.875rem] text-[#c43c2f]">
            {deleting ? "Processing…" : "Delete account"}
          </p>
          <p className="font-sans text-[0.75rem] text-hint mt-2 leading-relaxed">
            계정과 모든 운동·식단·저널 기록이 영구 삭제됩니다. 복구할 수 없습니다.
          </p>
        </button>
      </section>

      {/* 푸터 — 페이지 끝 마크 */}
      <div className="pt-6 mt-4 border-t border-ink/10 flex justify-between items-center font-sans text-[0.6875rem] text-hint">
        <span>FITCOACH</span>
        <span className="text-taupe">Settings</span>
      </div>
    </div>
  );
};

export default Settings;
