import { useEffect, useRef } from "react";
import { showLocalNotification } from "../utils/notify";

/**
 * 앱이 열려 있는 동안 지정 시각에 알림을 띄운다(발표용 foreground 스케줄러).
 * 설정은 localStorage(notif_prefs · notif_times)에서 읽는다.
 * 정식 배포 시엔 이 역할을 서버 스케줄러 + Web Push 가 대신해 앱이 꺼져도 동작한다.
 */
const DEFAULT_TIMES = { workout: "19:00", breakfast: "08:00", lunch: "12:30", dinner: "19:00" };

const load = (key, fallback) => {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return fallback;
  }
};

const ReminderScheduler = () => {
  const fired = useRef({}); // 같은 분에 중복 발송 방지: { "workout@2026-06-04@19:00": true }

  useEffect(() => {
    const tick = () => {
      const prefs = load("notif_prefs", {});
      const times = load("notif_times", DEFAULT_TIMES);
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      const fire = (key, title, body) => {
        const id = `${key}@${day}@${hhmm}`;
        if (fired.current[id]) return;
        fired.current[id] = true;
        showLocalNotification(title, body);
      };

      if (prefs.workout && times.workout === hhmm) {
        fire("workout", "운동 시간이에요 💪", "오늘의 루틴을 시작해볼까요?");
      }
      if (prefs.meal) {
        if (times.breakfast === hhmm) fire("breakfast", "아침 식사 기록 🍳", "아침 식단을 잊지 말고 기록해 주세요.");
        if (times.lunch === hhmm) fire("lunch", "점심 식사 기록 🍱", "점심 식단을 기록할 시간이에요.");
        if (times.dinner === hhmm) fire("dinner", "저녁 식사 기록 🍽️", "저녁 식단을 기록해 주세요.");
      }
    };

    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, []);

  return null;
};

export default ReminderScheduler;
