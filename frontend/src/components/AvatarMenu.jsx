import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api/config";
import { useAuth } from "../context/AuthContext";
import { AVATARS, avatarSrc } from "../constants/avatars";

/**
 * 마스트헤드의 아바타 버튼 + 아래로 펼쳐지는 선택 드롭다운.
 * 닉네임 텍스트 없이 아이콘만 두고, 누르면 바로 아래에 프리셋 그리드가 펼쳐진다.
 * 네비바는 루트 레벨이라 absolute 드롭다운(z-200)이 페이지·하단탭바 위로 정상 표시된다.
 */
const AvatarMenu = ({ up = false }) => {
  const { user, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const cur = avatarSrc(user?.avatar);
  const initial = (user?.nickname || user?.username)?.[0]?.toUpperCase() || "?";

  const pick = async (id) => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.patch(
        `${API_BASE_URL}/user/me`,
        { avatar: id || "" },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateProfile({ avatar: res.data.avatar });
      setOpen(false);
    } catch {
      /* 조용히 실패 */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative self-center">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="아바타 선택"
        aria-expanded={open}
        className="w-8 h-8 rounded-full overflow-hidden border border-ink/15 bg-bone flex items-center justify-center font-sans text-[0.72rem] font-medium text-taupe hover:border-lilac-deep transition-colors"
      >
        {cur ? <img src={cur} alt="" className="w-full h-full object-cover" /> : initial}
      </button>

      {open && (
        <>
          {/* 바깥 클릭 시 닫기 */}
          <div className="fixed inset-0 z-[190]" onClick={() => setOpen(false)} />

          {/* 펼쳐지는 패널 — up 이면 위로, 아니면 아래로 */}
          <div
            className={`absolute z-[200] w-56 bg-paper rounded-[16px] border border-ink/10 shadow-[0_18px_44px_-16px_rgba(26,20,16,0.32)] p-3 animate-in fade-in duration-150 ${
              up ? "left-0 bottom-full mb-2" : "right-0 top-full mt-2"
            }`}
          >
            <div className="font-sans text-[0.7rem] font-medium tracking-wide uppercase text-taupe mb-2 px-0.5">
              Avatar
            </div>
            <div className="grid grid-cols-3 gap-2">
              {AVATARS.map((a) => {
                const sel = user?.avatar === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={saving}
                    onClick={() => pick(a.id)}
                    aria-pressed={sel}
                    className={`aspect-square rounded-full overflow-hidden border-2 transition-colors disabled:opacity-50 ${
                      sel ? "border-lilac-deep" : "border-ink/10 hover:border-ink/30"
                    }`}
                  >
                    <img src={a.src} alt={a.id} className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => pick(null)}
              disabled={saving}
              className="w-full mt-2.5 rounded-[10px] font-sans text-[0.72rem] font-medium py-2 text-taupe hover:text-ink hover:bg-ink/[0.04] transition-colors disabled:opacity-50"
            >
              기본 (선택 해제)
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AvatarMenu;
