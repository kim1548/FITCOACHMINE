# -*- coding: utf-8 -*-
"""FitCoach ERD (데이터베이스 다이어그램) 생성 — matplotlib → PNG."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyArrowPatch
from matplotlib import font_manager as fm

font_path = r"C:\Windows\Fonts\malgun.ttf"
fp = fm.FontProperties(fname=font_path)
plt.rcParams["font.family"] = fp.get_name()
plt.rcParams["axes.unicode_minus"] = False

W, H = 21.4, 17.3
fig, ax = plt.subplots(figsize=(W, H), dpi=150)
ax.set_xlim(0, W)
ax.set_ylim(0, H)
ax.axis("off")

RED = "#c0392b"; BLUE = "#2c6e9b"; TEAL = "#138d75"
ORANGE = "#ca6f1e"; PURPLE = "#7d3c98"; GOLD = "#b8860b"
SLATE = "#566573"; GREY = "#909497"
HEADER = 0.56
ROW = 0.42

ENT = {}

def entity(name, x, yt, w, cols, color):
    n = len(cols)
    bh = HEADER + n * ROW
    yb = yt - bh
    ax.add_patch(Rectangle((x, yb), w, bh, facecolor="white",
                           edgecolor=color, lw=1.7, zorder=3))
    ax.add_patch(Rectangle((x, yt - HEADER), w, HEADER, facecolor=color,
                           edgecolor=color, lw=1.7, zorder=4))
    ax.text(x + w / 2, yt - HEADER / 2, name, ha="center", va="center",
            color="white", fontsize=16, fontweight="bold",
            fontproperties=fp, zorder=5)
    for i, (cname, tag) in enumerate(cols):
        cy = yt - HEADER - (i + 0.5) * ROW
        if i > 0:
            ax.plot([x, x + w], [yt - HEADER - i * ROW] * 2,
                    color=color, lw=0.4, alpha=0.2, zorder=4)
        weight, style, tcolor, badge = "normal", "normal", "#222222", ""
        if tag == "PK":
            weight, badge = "bold", "PK "
        elif tag == "FK":
            style, tcolor, badge = "italic", BLUE, "FK "
        elif tag == "UQ":
            badge = "UQ "
        ax.text(x + 0.18, cy, badge + cname, ha="left", va="center",
                fontsize=13, fontproperties=fp, color=tcolor,
                fontweight=weight, style=style, zorder=5)
    ENT[name] = dict(x=x, yt=yt, yb=yb, w=w, cx=x + w / 2, cy=(yt + yb) / 2)


def rel(parent, child, rad=0.0):
    """parent.오른쪽 → child.왼쪽 (1:N)."""
    p, c = ENT[parent], ENT[child]
    start = (p["x"] + p["w"], p["cy"])
    end = (c["x"], c["cy"])
    ax.add_patch(FancyArrowPatch(start, end, arrowstyle="-|>", mutation_scale=15,
                 lw=1.3, color="#5d6d7e", zorder=2, shrinkA=2, shrinkB=2,
                 connectionstyle=f"arc3,rad={rad}"))
    ax.text(start[0] + 0.12, start[1] + 0.14, "1", fontsize=13.5,
            color="#5d6d7e", zorder=2, fontweight="bold")
    ax.text(end[0] - 0.36, end[1] + 0.14, "N", fontsize=13.5,
            color="#5d6d7e", zorder=2, fontweight="bold")


def rel_left(parent, child, rad=0.45):
    """같은 열 내부: parent.왼쪽 → child.왼쪽 (왼쪽으로 호)."""
    p, c = ENT[parent], ENT[child]
    start = (p["x"], p["cy"])
    end = (c["x"], c["cy"])
    ax.add_patch(FancyArrowPatch(start, end, arrowstyle="-|>", mutation_scale=15,
                 lw=1.3, color="#5d6d7e", zorder=2, shrinkA=2, shrinkB=2,
                 connectionstyle=f"arc3,rad={rad}"))
    ax.text(start[0] - 0.25, start[1], "1", fontsize=13.5, color="#5d6d7e",
            zorder=2, fontweight="bold")
    ax.text(end[0] - 0.25, end[1], "N", fontsize=13.5, color="#5d6d7e",
            zorder=2, fontweight="bold")


# ---------- 엔티티 정의 ----------
entity("users", 0.5, 11.0, 4.7, [
    ("id", "PK"), ("username", "UQ"), ("password", ""), ("nickname", ""),
    ("avatar", ""), ("gender", ""), ("age", ""), ("height", ""), ("weight", ""),
    ("lifestyle", ""), ("workout_experience", ""), ("workout_frequency", ""),
    ("fitness_level", ""), ("goal", ""), ("created_at", ""),
], RED)

entity("workout_logs  (레거시)", 0.5, 3.7, 4.7, [
    ("id", "PK"), ("exercise_name", ""), ("counter", ""), ("score", ""),
    ("image_path", ""), ("created_at", ""),
], GREY)

entity("user_routine_stats", 5.6, 15.6, 4.9, [
    ("id", "PK"), ("user_id", "FK"), ("exercise_name", ""), ("current_1rm", ""),
    ("training_max", ""), ("step_weight", ""), ("current_level", ""),
    ("goal_reps", ""), ("last_updated", ""),
], BLUE)

entity("routine_logs", 5.6, 11.3, 4.9, [
    ("id", "PK"), ("user_id", "FK"), ("routine_name", ""), ("workout_date", ""),
    ("session_data (JSON)", ""), ("total_volume", ""), ("memo", ""),
], BLUE)

entity("formcheck_logs", 5.6, 7.4, 4.9, [
    ("id", "PK"), ("user_id", "FK"), ("logged_date", ""), ("exercise_type", ""),
    ("score", ""), ("rep_count", ""), ("cat_scores (JSON)", ""),
    ("cat_details (JSON)", ""), ("overall", ""), ("created_at", ""),
], TEAL)

entity("inbody_logs", 10.9, 16.0, 4.9, [
    ("id", "PK"), ("user_id", "FK"), ("measured_at", ""), ("weight", ""),
    ("skeletal_muscle", ""), ("body_fat_mass", ""), ("body_fat_percent", ""),
    ("bmr", ""), ("ai_comment", ""), ("ai_generated_at", ""), ("created_at", ""),
], PURPLE)

entity("diet_logs", 10.9, 11.1, 4.9, [
    ("id", "PK"), ("user_id", "FK*"), ("date", ""), ("created_at", ""),
    ("meal_type", ""), ("entry_group_id", ""), ("food_name", ""),
    ("calories", ""), ("carbs", ""), ("protein", ""), ("fat", ""),
    ("weight", ""), ("image_url", ""), ("is_favorite", ""), ("memo", ""),
], ORANGE)

entity("journal_entries", 10.9, 4.7, 4.9, [
    ("id", "PK"), ("user_id", "FK"), ("entry_date", ""), ("ai_comment", ""),
    ("ai_generated_at", ""), ("user_note", ""), ("updated_at", ""),
], GOLD)

entity("community_posts", 16.2, 15.6, 4.7, [
    ("id", "PK"), ("user_id", "FK"), ("body", ""), ("address", ""),
    ("bench", ""), ("deadlift", ""), ("squat", ""), ("created_at", ""),
    ("updated_at", ""),
], SLATE)

entity("community_likes", 16.2, 10.6, 4.7, [
    ("id", "PK"), ("post_id", "FK"), ("user_id", "FK"), ("created_at", ""),
], SLATE)

entity("community_comments", 16.2, 7.9, 4.7, [
    ("id", "PK"), ("post_id", "FK"), ("user_id", "FK"), ("body", ""),
    ("is_secret", ""), ("created_at", ""), ("updated_at", ""),
], SLATE)

# ---------- 관계 (1:N) ----------
rel("users", "user_routine_stats", rad=-0.18)
rel("users", "routine_logs", rad=-0.05)
rel("users", "formcheck_logs", rad=0.12)
rel("users", "inbody_logs", rad=-0.22)
rel("users", "diet_logs", rad=0.04)
rel("users", "journal_entries", rad=0.22)
rel("users", "community_posts", rad=-0.28)
rel_left("community_posts", "community_likes", rad=0.5)
rel_left("community_posts", "community_comments", rad=0.5)

# ---------- 제목 / 범례 ----------
ax.text(W / 2, 16.9, "FitCoach ERD — 데이터베이스 다이어그램 (SQLite · 11 Tables)",
        ha="center", va="center", fontsize=19, fontproperties=fp,
        color="#1f2933", fontweight="bold")

legend = (
    "PK 기본키   ·   FK 외래키   ·   UQ 유니크   ·   1 ──▶ N 일대다 관계\n"
    "※ community_likes · community_comments 는 user_id 로 users(작성자)도 참조 (선 생략)   |   "
    "diet_logs.user_id(FK*) 는 인덱스 기반 논리적 FK   |   workout_logs 는 레거시(미사용)"
)
ax.text(W / 2, 0.45, legend, ha="center", va="center", fontsize=13.5,
        fontproperties=fp, color="#566573")

plt.tight_layout()
out = r"C:\Project\FitEating-main\docs\erd_diagram.png"
plt.savefig(out, dpi=150, bbox_inches="tight", facecolor="white")
print("saved:", out)
