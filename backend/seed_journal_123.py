"""발표용 — 계정 '123'(체중감소 목표 25세 남성)의 저널을 오늘 날짜까지 사실적으로 채운다.

기존 운동/식단/저널/체성분/폼체크 기록을 비우고, 약 10주(2026-04-06 ~ 2026-06-19)의
일관된 다이어트 여정(체중 73→69kg, 체지방 21→16%)을 생성한다.
StrongLifts A/B 점진적 과부하, 일일 식단, 주간 인바디, 주말 폼체크, 한 줄 메모+AI 코멘트.

실행: backend 디렉터리에서  python seed_journal_123.py
"""

from datetime import date, datetime, timedelta, time

from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.routine_log import RoutineLog
from app.models.diet_log import DietLog
from app.models.journal_entry import JournalEntry
from app.models.inbody_log import InBodyLog
from app.models.formcheck_log import FormCheckLog

Base.metadata.create_all(bind=engine)

USERNAME = "123"
START = date(2026, 4, 6)     # 월요일
TODAY = date(2026, 6, 19)    # 금요일 (오늘)
SPAN = (TODAY - START).days


def r25(x):
    return round(x / 2.5) * 2.5


def frac(d):
    return (d - START).days / SPAN


# ---------- 음식 (per 100g): key -> (이름, kcal, 탄, 단, 지) ----------
FOODS = {
    "oat":     ("오트밀",       389, 66, 17, 7),
    "banana":  ("바나나",        89, 23, 1.1, 0.3),
    "soymilk": ("두유",          54, 6, 3.6, 1.8),
    "egg":     ("삶은 계란",     155, 1.1, 13, 11),
    "brown":   ("현미밥",        150, 33, 3, 1),
    "kimchi":  ("김치",          15, 2.4, 1.1, 0.5),
    "greek":   ("그릭요거트",     59, 3.6, 10, 0.4),
    "almond":  ("아몬드",        579, 22, 21, 50),
    "apple":   ("사과",          52, 14, 0.3, 0.2),
    "chicken": ("닭가슴살",      165, 0, 31, 3.6),
    "broc":    ("브로콜리",       34, 7, 2.8, 0.4),
    "multi":   ("잡곡밥",        160, 34, 4, 1),
    "beef":    ("소고기 살코기",  250, 0, 26, 16),
    "tomato":  ("방울토마토",     18, 3.9, 0.9, 0.2),
    "sweet":   ("고구마",         86, 20, 1.6, 0.1),
    "salmon":  ("연어구이",      208, 0, 20, 13),
    "tofu":    ("두부",          76, 1.9, 8, 4.8),
    "shake":   ("단백질 쉐이크",  380, 14, 75, 5),
}

# 끼니 템플릿 — (음식key, 그램)
BREAKFAST = [
    [("oat", 50), ("banana", 120), ("soymilk", 200)],
    [("egg", 100), ("brown", 150), ("kimchi", 80)],
    [("greek", 150), ("almond", 25), ("apple", 180)],
]
LUNCH = [
    [("brown", 210), ("chicken", 150), ("broc", 100)],
    [("multi", 200), ("beef", 120), ("tomato", 100)],
    [("sweet", 200), ("chicken", 150), ("kimchi", 80)],
]
DINNER = [
    [("salmon", 130), ("multi", 150), ("broc", 100)],
    [("tofu", 150), ("brown", 150), ("kimchi", 80)],
    [("chicken", 150), ("sweet", 150), ("tomato", 100)],
]
SNACK = [
    [("shake", 33)],
    [("banana", 120), ("almond", 25)],
    [("greek", 150)],
]

# ---------- 리프트 점진적 과부하 (start, end kg) ----------
LIFTS = {
    "squat":    ("스쿼트", 60, 105),
    "bench":    ("벤치프레스", 42.5, 67.5),
    "row":      ("바벨로우", 50, 75),
    "ohp":      ("오버헤드프레스", 30, 47.5),
    "deadlift": ("데드리프트", 70, 120),
}


def lift_weight(key, d):
    s, e = LIFTS[key][1], LIFTS[key][2]
    return r25(s + (e - s) * frac(d))


def make_session(day_type, d):
    """StrongLifts A=Squat/Bench/Row, B=Squat/OHP/Deadlift."""
    plan = (["squat", "bench", "row"] if day_type == "A"
            else ["squat", "ohp", "deadlift"])
    lifts = []
    volume = 0.0
    for key in plan:
        w = lift_weight(key, d)
        prev = r25(w - 2.5)
        n_sets = 1 if key == "deadlift" else 5
        sets = []
        for i in range(n_sets):
            # 마지막 세트 가끔 실패(현실감) — 진행 후반일수록 가끔
            reps = 5
            completed = True
            if i == n_sets - 1 and (d.day % 7 == 0) and key != "deadlift":
                reps, completed = 3, False
            sets.append({"reps": reps, "completed": completed})
            if completed:
                volume += w * reps
        lifts.append({
            "lift_id": key, "anchor_key": key,
            "weight": float(w), "prev_weight": float(prev),
            "outcome": "increase", "sets": sets,
        })
    name = "StrongLifts 5×5 · A" if day_type == "A" else "StrongLifts 5×5 · B"
    return name, lifts, round(volume, 1)


def is_workout(d):
    delta = (TODAY - d).days
    if delta <= 5:
        return True          # 최근 6일(6/14~6/19) 연속 → 스트릭 6
    if delta == 6:
        return False         # 6/13 휴식 → 스트릭 경계
    wd = d.weekday()
    return wd in (0, 1, 3, 4, 5)   # 월화목금토 (수,일 휴식)


USER_NOTES = [
    "오늘은 컨디션 좋아서 스쿼트 무게 올렸다 💪", "퇴근하고 헬스장 직행. 뿌듯하다",
    "식단 잘 지킴. 치팅 유혹 참았다", "어제 과식해서 오늘 유산소 추가했음",
    "허벅지 너무 아프다 ㅋㅋ 그래도 뿌듯", "벤치 정체기지만 꾸준히 가본다",
    "체중 또 빠졌다! 동기부여 200%", "물 2L 챙겨 마시기 성공",
    "오늘은 좀 피곤해서 가볍게 마무리", "단백질 목표량 채웠다",
    "주말인데 운동 안 빠졌다 칭찬해", "데드 자세 영상 찍어봄. 폼 좋아진 듯",
    "야식 참기 성공 🔥", "아침 공복 유산소 30분 완료",
    "스트레칭 꼼꼼히 하고 잤다", "오늘 거울 보니 라인이 살아난다",
    "잠을 잘 못 자서 무게는 유지만", "한 주 운동 마무리 깔끔하게",
    "확실히 바지가 헐렁해졌다", "목표까지 조금만 더 가보자",
]

AI_COMMENTS = [
    "오늘도 운동과 식단을 모두 챙기셨네요. 이 꾸준함이 가장 큰 무기입니다.",
    "단백질 섭취가 목표에 잘 맞춰져 있어 근손실 걱정은 덜어도 좋겠습니다.",
    "하체 볼륨이 충분했습니다. 내일은 회복과 스트레칭에 신경 써보세요.",
    "칼로리 적자를 안정적으로 유지하고 있어요. 이 페이스라면 목표가 멀지 않았습니다.",
    "벤치가 정체 구간이지만 보조 운동과 수면으로 충분히 뚫을 수 있습니다.",
    "체지방은 줄고 골격근량은 유지되는 이상적인 다이어트 흐름입니다.",
    "수분과 수면만 더 챙기면 다음 주 중량 상승이 기대됩니다.",
]

# 폼체크 — (운동, 점수, rep, {cat:score}, {cat:detail}, 총평)
FC_ROTATION = ["스쿼트", "벤치프레스", "데드리프트"]


def make_formcheck(ex, score, d):
    weak = max(60, int(score) - 18)
    mid = max(70, int(score) - 8)
    cat_scores = {
        "Stability": float(min(100, int(score) + 6)),
        "ROM": float(weak),
        "Movement Quality": float(min(100, int(score) + 2)),
        "Posture": float(mid),
        "Core": float(weak + 4),
    }
    cat_details = {
        "ROM": "조금 더 깊이 앉아 가동범위를 확보해보세요.",
        "Core": "복압을 끝까지 유지하면 안정성이 올라갑니다.",
    }
    overall = (f"{ex} 종합 {int(score)}점. 전반적으로 안정적이며, "
               f"가동범위와 코어 긴장만 보완하면 더 좋아질 폼입니다.")
    return cat_scores, cat_details, overall


def run():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == USERNAME).first()
        if user is None:
            print(f"[ERR] username={USERNAME} 사용자를 찾을 수 없습니다.")
            return
        uid = user.id

        # 0) 기존 저널 데이터 비우기
        for M in (RoutineLog, DietLog, JournalEntry, InBodyLog, FormCheckLog):
            db.query(M).filter(M.user_id == uid).delete(synchronize_session=False)
        db.commit()

        n_w = n_d = n_e = n_b = n_f = 0
        workout_idx = 0
        fc_idx = 0

        d = START
        while d <= TODAY:
            ordn = (d - START).days

            # ----- 운동 -----
            if is_workout(d):
                day_type = "A" if workout_idx % 2 == 0 else "B"
                workout_idx += 1
                name, lifts, vol = make_session(day_type, d)
                db.add(RoutineLog(
                    user_id=uid, routine_name=name,
                    workout_date=datetime.combine(d, time(19, 30)),
                    session_data=lifts, total_volume=vol, memo=None,
                ))
                n_w += 1

            # ----- 식단 (매일 4끼) -----
            for meal_type, pool in (("아침", BREAKFAST), ("점심", LUNCH),
                                    ("저녁", DINNER), ("간식", SNACK)):
                template = pool[ordn % len(pool)]
                for fkey, grams in template:
                    nm, kcal, c, p, f = FOODS[fkey]
                    db.add(DietLog(
                        user_id=uid, date=d, meal_type=meal_type,
                        food_name=nm, calories=float(kcal),
                        carbs=float(c), protein=float(p), fat=float(f),
                        weight=float(grams),
                    ))
                    n_d += 1

            # ----- 인바디 (일요일 + 오늘) -----
            if d.weekday() == 6 or d == TODAY:
                w = round(73 - 4 * frac(d), 1)
                bf = round(21 - 5 * frac(d), 1)
                sm = round(32.5 + 1.3 * frac(d), 1)
                bfm = round(w * bf / 100, 1)
                bmr = round(10 * w + 6.25 * 170 - 5 * 25 + 5)
                db.add(InBodyLog(
                    user_id=uid, measured_at=d,
                    weight=w, skeletal_muscle=sm, body_fat_mass=bfm,
                    body_fat_percent=bf, bmr=float(bmr),
                    created_at=datetime.combine(d, time(8, 0)),
                ))
                n_b += 1

            # ----- 폼체크 (토요일) -----
            if d.weekday() == 5:
                ex = FC_ROTATION[fc_idx % len(FC_ROTATION)]
                fc_idx += 1
                score = round(min(95, 73 + 22 * frac(d)))
                cs, cd, ov = make_formcheck(ex, score, d)
                db.add(FormCheckLog(
                    user_id=uid, logged_date=d, exercise_type=ex,
                    score=float(score), rep_count=5 + (ordn % 5),
                    cat_scores=cs, cat_details=cd, overall=ov,
                    created_at=datetime.combine(d, time(19, 45)),
                ))
                n_f += 1

            # ----- 저널 한 줄 + AI 코멘트 -----
            note = USER_NOTES[ordn % len(USER_NOTES)]
            ai = AI_COMMENTS[ordn % len(AI_COMMENTS)] if (ordn % 2 == 0 or is_workout(d)) else None
            db.add(JournalEntry(
                user_id=uid, entry_date=d,
                user_note=note,
                ai_comment=ai,
                ai_generated_at=datetime.combine(d, time(22, 0)) if ai else None,
            ))
            n_e += 1

            d += timedelta(days=1)

        db.commit()
        print(f"[OK] user={USERNAME} period={START}~{TODAY} "
              f"workouts={n_w} diet_rows={n_d} entries={n_e} inbody={n_b} formcheck={n_f}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
