# -*- coding: utf-8 -*-
"""데모 데이터 정리: 루틴 찌꺼기/폼체크 이상치 삭제 + 1RM 통계(꾸준히 향상) 삽입. user_id=7(123)."""
import sys, io, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
U = 7
c = sqlite3.connect('test.db'); cur = c.cursor()

# 1) 루틴 찌꺼기 삭제 (Workout A / 볼륨 0)
cur.execute("DELETE FROM routine_logs WHERE user_id=? AND total_volume=0 AND routine_name NOT LIKE 'StrongLifts%'", (U,))
print('루틴 찌꺼기 삭제:', cur.rowcount)

# 2) 폼체크 이상치 삭제 (6/19·6/22 스쿼트 75 → 74~93 상승추세 유지)
cur.execute("DELETE FROM formcheck_logs WHERE user_id=? AND logged_date IN ('2026-06-19','2026-06-22') AND score=75", (U,))
print('폼체크 이상치 삭제:', cur.rowcount)

# 3) 1RM 통계 삽입 (현재 작업무게 기준, Epley 5RM→1RM)
work = {'squat':105.0, 'bench':67.5, 'deadlift':120.0, 'ohp':47.5, 'row':75.0}
start = {'squat':40, 'bench':40, 'deadlift':60, 'ohp':30, 'row':40}
step = {'squat':2.5, 'bench':2.5, 'deadlift':5.0, 'ohp':2.5, 'row':2.5}
def epley(w): return round(w*(1+5/30)*2)/2  # 0.5 반올림
cur.execute("DELETE FROM user_routine_stats WHERE user_id=?", (U,))
for ex, w in work.items():
    one = epley(w)
    lvl = int(round((w-start[ex])/step[ex]))
    cur.execute("""INSERT INTO user_routine_stats
        (user_id,exercise_name,current_1rm,training_max,step_weight,current_level,goal_reps,last_updated)
        VALUES (?,?,?,?,?,?,?, '2026-06-19 19:30:00')""",
        (U, ex, one, w, step[ex], lvl, 5))
    print(f'  통계: {ex} TM={w} 1RM={one} lvl={lvl}')

c.commit()
print('--- 검증 ---')
print('1RM 통계:', cur.execute("select exercise_name,current_1rm,training_max,current_level from user_routine_stats where user_id=?",(U,)).fetchall())
print('루틴 비정상 남음:', cur.execute("select count(*) from routine_logs where user_id=? and (total_volume=0 or routine_name not like 'StrongLifts%')",(U,)).fetchone())
print('폼체크 마지막 3건:', cur.execute("select logged_date,exercise_type,score from formcheck_logs where user_id=? order by logged_date desc limit 3",(U,)).fetchall())
c.close()
print('done')
