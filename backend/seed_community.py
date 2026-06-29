"""커뮤니티 데모 시드 — 발표용 가상 커뮤니티 데이터.

기존 글/댓글/좋아요를 모두 비우고, 데모 유저(username demo_*)와
사실적인 한국 헬스 커뮤니티 글·댓글·좋아요를 채워 넣는다.
실제 가입 유저는 보존(글만 사라짐). 멱등 — 여러 번 돌려도 동일 결과.

실행: backend 디렉터리에서  python seed_community.py
"""

from datetime import datetime, timedelta

from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.community import CommunityPost, CommunityLike, CommunityComment
from app.core.security import get_password_hash

Base.metadata.create_all(bind=engine)

NOW = datetime.now()
PW = get_password_hash("demo1234!")


def H(hours):
    return NOW - timedelta(hours=hours)


# ---------- 데모 유저 (username, nickname, avatar, gender, age, height, weight) ----------
USERS = [
    ("demo_jun",    "벤치프레스장인",   "male1",   "남", 29, 178, 80),
    ("demo_minho",  "데드리프트민호",   "male2",   "남", 33, 182, 88),
    ("demo_seojun", "헬린이서준",       "male3",   "남", 24, 175, 68),
    ("demo_jiyeon", "오운완지영",       "female1", "여", 28, 164, 55),
    ("demo_hara",   "스쿼트하라",       "female2", "여", 26, 167, 58),
    ("demo_yuna",   "요가하는유나",     "female3", "여", 31, 160, 52),
    ("demo_tae",    "새벽운동러",       None,      "남", 35, 176, 78),  # 아바타 없음 → 이니셜 폴백
]


# ---------- 글 (key, author, body, address, squat, bench, deadlift, hours_ago) ----------
POSTS = [
    ("p_form", "demo_seojun",
     "스쿼트할 때 무릎이 자꾸 안쪽으로 모이는데 어떻게 고치나요? 헬린이라 잘 모르겠어요 ㅠㅠ\n"
     "영상 보면서 따라하는데도 무게만 올리면 무너지네요. 고수님들 조언 부탁드립니다!",
     "마포", 60, None, None, 1),

    ("p_mate", "demo_jun",
     "강남 ○○피트니스에서 같이 운동하실 분 구해요! 주로 저녁 7시 이후에 합니다.\n"
     "푸시·풀·레그 같이 도실 분 환영합니다 🙌 보조 봐주면서 자극 제대로 느껴봐요.",
     "강남", 140, 110, 170, 3),

    ("p_owun", "demo_jiyeon",
     "오늘도 오운완! 하체 끝나고 유산소 40분까지 풀로 채웠습니다.\n"
     "이번 주 5일 다 출석 성공 ㅎㅎ 다들 오늘도 화이팅하세요 💪",
     "분당", 95, None, None, 5),

    ("p_dawn", "demo_tae",
     "새벽 5시 오픈런 하시는 분 계신가요? 혼자 하니까 동기부여가 잘 안 되네요.\n"
     "같이 으샤으샤 하면서 꾸준히 가실 분 찾습니다. 일산 쪽이에요!",
     "일산", None, None, None, 6),

    ("p_pr", "demo_minho",
     "데드리프트 드디어 200kg 쳤습니다!!! 1년 반 걸렸네요 ㅠㅠ\n"
     "허리 다칠까봐 욕심 안 내고 천천히 올린 게 결국 답이었어요. 다음 목표는 220!",
     "송파", 170, 130, 200, 8),

    ("p_injury", "demo_jiyeon",
     "어깨 임핀지먼트 때문에 벤치를 못 하는 중인데, 이럴 때 할 수 있는 운동 추천 좀 부탁드려요.\n"
     "재활 경험 있으신 분들 어떻게 회복하셨는지 조언 구합니다 🙏",
     "분당", None, 50, None, 12),

    ("p_plateau", "demo_hara",
     "스쿼트 100kg에서 두 달째 정체기예요... 5x5 꾸준히 했는데 더 안 올라가네요.\n"
     "프로그램을 바꿔야 할까요? 비슷한 정체기 겪으신 분들 어떻게 뚫으셨나요?",
     "수원", 100, None, 120, 26),

    ("p_supp", "demo_jun",
     "크레아틴 입문하려는데 추천 좀 해주세요. 모노하이드레이트면 브랜드별로 차이 있나요?\n"
     "괜히 비싼 거 살 필요 없다는 말도 있고... 경험자분들 의견 궁금합니다.",
     "강남", None, 110, None, 30),

    ("p_diet", "demo_yuna",
     "다이어트 식단 공유해요! 닭가슴살 질려서 요즘은 두부랑 연어로 단백질 챙기는 중이에요.\n"
     "맛있으면서 단백질 높은 레시피 있으면 같이 공유해요 :) 같이 자극받고 싶어요!",
     "강서", None, None, None, 48),
]


# ---------- 댓글 (post_key, author, body, is_secret, hours_ago) ----------
COMMENTS = [
    # 폼 질문 — 여러 사람이 조언
    ("p_form", "demo_minho", "무릎 모이는 건 보통 둔근·고관절 외전근이 약해서 그래요. 미니밴드 차고 스쿼트 연습해보세요!", False, 0.6),
    ("p_form", "demo_hara",  "발끝 방향으로 무릎을 '밀어낸다'는 느낌으로 해보세요. 거울 보면서 가벼운 무게로 패턴부터!", False, 0.4),
    ("p_form", "demo_jun",   "헬린이 때 다들 거쳐가는 과정이에요 ㅋㅋ 너무 조급해 말고 꾸준히 하면 좋아집니다 👍", False, 0.2),

    # 메이트 구함 — 소통 + 비밀댓글
    ("p_mate", "demo_jiyeon", "저도 강남이고 시간대 비슷해요! 혹시 어느 짐이세요?", False, 2.5),
    ("p_mate", "demo_jun",    "○○피트니스요 ㅎㅎ 관심 있으시면 쪽지 주세요!", False, 2.2),
    ("p_mate", "demo_yuna",   "연락처 쪽지로 남겨둘게요 :)", True, 2.0),
    ("p_mate", "demo_minho",  "푸시풀레그 부럽네요 ㅋㅋ 저도 같이 하고 싶다", False, 1.5),

    # 오운완 — 응원
    ("p_owun", "demo_seojun", "5일 출석 리스펙입니다 👏 저는 3일이 한계인데...", False, 4.0),
    ("p_owun", "demo_tae",    "하체 끝나고 유산소까지 진짜 대단하시네요!", False, 3.0),

    # 새벽운동 — 소통
    ("p_dawn", "demo_jun",   "새벽운동 의지 멋지네요. 전 저녁파라 도전 못 하겠어요 ㅠㅠ", False, 5.0),
    ("p_dawn", "demo_minho", "오픈런 가끔 하는데 사람 없어서 오히려 집중 잘 되더라고요 ㅋㅋ", False, 4.0),

    # PR 자랑 — 축하
    ("p_pr", "demo_jun",  "와 200 축하드립니다!! 🎉 저도 곧 도전하려고요", False, 7.0),
    ("p_pr", "demo_tae",  "1년 반 꾸준함이 진짜 멋지네요. 자극받고 갑니다", False, 6.0),
    ("p_pr", "demo_yuna", "대박이에요... 그래도 허리 항상 조심하세요!", False, 5.0),

    # 부상 — 조언
    ("p_injury", "demo_hara",  "저도 어깨 아팠을 때 페이스풀이랑 밴드 운동 위주로 돌렸어요. 절대 무리 마세요!", False, 10.0),
    ("p_injury", "demo_minho", "방치하면 오래가요. 정형외과 한 번 가보시는 거 진심 추천합니다 🙏", False, 9.0),

    # 정체기 — 조언 + 글쓴이 답글
    ("p_plateau", "demo_minho", "5x5 두 달 했으면 디로드 한 주 하고 다시 올려보세요. 수면이랑 단백질도 점검하시고!", False, 24.0),
    ("p_plateau", "demo_hara",  "디로드는 생각 못 했네요. 이번 주 가볍게 가보고 후기 남길게요. 감사합니다!", False, 22.0),
    ("p_plateau", "demo_jiyeon","정체기엔 볼륨 살짝 늘리는 것도 도움 됐어요. 화이팅하세요 💪", False, 20.0),

    # 보충제 — 정보
    ("p_supp", "demo_minho", "성분이 모노하이드레이트면 효과는 거의 동일해요. 인증받은 가성비 제품이면 충분합니다.", False, 28.0),
    ("p_supp", "demo_seojun","저도 이거 궁금했는데 덕분에 정리됐어요 감사합니다!", False, 26.0),

    # 식단 — 공유
    ("p_diet", "demo_jiyeon", "연어 좋죠! 저는 그릭요거트에 견과류 올려 먹는 것도 추천해요 :)", False, 44.0),
    ("p_diet", "demo_seojun", "두부 단백질 꿀팁 감사합니다 ㅎㅎ 오늘 장 봐야겠어요", False, 40.0),
]


# ---------- 좋아요 (post_key, [usernames]) ----------
LIKES = {
    "p_form":    ["demo_jun", "demo_jiyeon", "demo_hara"],
    "p_mate":    ["demo_jiyeon", "demo_minho", "demo_hara", "demo_yuna", "demo_tae", "demo_seojun"],
    "p_owun":    ["demo_jun", "demo_minho", "demo_seojun", "demo_hara", "demo_tae", "demo_yuna"],
    "p_dawn":    ["demo_jun", "demo_minho"],
    "p_pr":      ["demo_jun", "demo_jiyeon", "demo_seojun", "demo_hara", "demo_yuna", "demo_tae"],
    "p_injury":  ["demo_hara", "demo_minho", "demo_yuna"],
    "p_plateau": ["demo_minho", "demo_jiyeon", "demo_jun"],
    "p_supp":    ["demo_minho", "demo_seojun", "demo_jiyeon"],
    "p_diet":    ["demo_jiyeon", "demo_seojun", "demo_hara", "demo_minho"],
}


def run():
    db = SessionLocal()
    try:
        # 1) 기존 커뮤니티 데이터 전부 삭제
        db.query(CommunityLike).delete()
        db.query(CommunityComment).delete()
        db.query(CommunityPost).delete()
        db.commit()

        # 2) 데모 유저 재생성 (이전 시드 정리 후)
        db.query(User).filter(User.username.like("demo_%")).delete(synchronize_session=False)
        db.commit()

        user_by_name = {}
        for username, nick, avatar, gender, age, h, w in USERS:
            u = User(
                username=username, password=PW, nickname=nick, avatar=avatar,
                gender=gender, age=age, height=h, weight=w,
                lifestyle="일반사무직", workout_experience="경력자",
                workout_frequency="주4회", fitness_level=None, goal="유지",
            )
            db.add(u)
            user_by_name[username] = u
        db.commit()
        for u in user_by_name.values():
            db.refresh(u)

        # 3) 글
        post_by_key = {}
        for key, author, body, addr, sq, bn, dl, ago in POSTS:
            uid = user_by_name[author].id
            p = CommunityPost(
                user_id=uid, body=body, address=addr,
                squat=sq, bench=bn, deadlift=dl,
                created_at=H(ago), updated_at=H(ago),
            )
            db.add(p)
            post_by_key[key] = p
        db.commit()
        for p in post_by_key.values():
            db.refresh(p)

        # 4) 댓글
        for key, author, body, secret, ago in COMMENTS:
            db.add(CommunityComment(
                post_id=post_by_key[key].id,
                user_id=user_by_name[author].id,
                body=body, is_secret=secret,
                created_at=H(ago), updated_at=H(ago),
            ))
        db.commit()

        # 5) 좋아요
        for key, names in LIKES.items():
            for n in names:
                db.add(CommunityLike(
                    post_id=post_by_key[key].id,
                    user_id=user_by_name[n].id,
                    created_at=H(1),
                ))
        db.commit()

        print(f"[OK] seeded: users={len(USERS)} posts={len(POSTS)} "
              f"comments={len(COMMENTS)} likes={sum(len(v) for v in LIKES.values())}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
