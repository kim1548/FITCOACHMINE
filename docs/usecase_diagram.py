# -*- coding: utf-8 -*-
"""FitCoach 유스케이스 다이어그램 생성 (matplotlib → PNG)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, FancyArrowPatch
from matplotlib import font_manager as fm

# 한글 폰트
font_path = r"C:\Windows\Fonts\malgun.ttf"
fp = fm.FontProperties(fname=font_path)
plt.rcParams["font.family"] = fp.get_name()
plt.rcParams["axes.unicode_minus"] = False

W, H = 17.0, 11.5
fig, ax = plt.subplots(figsize=(W, H), dpi=150)
ax.set_xlim(0, W)
ax.set_ylim(0, H)
ax.axis("off")

INK = "#1f2933"
RED = "#c0392b"
GOLD = "#b8860b"
BLUE = "#2c6e9b"
GREY = "#7b8794"

# 색상별 옅은 채움색 (액터·유스케이스 공용)
TINT = {RED: "#fdf6f4", BLUE: "#eef4f8", GOLD: "#fdf9ef", GREY: "#f3f4f5"}

# ---------- 액터(원 안에 텍스트) ----------
def actor(x, y, label, color=RED, r=0.85, fs=12.5):
    ax.add_patch(plt.Circle((x, y), r, facecolor=TINT.get(color, "#ffffff"),
                            edgecolor=color, lw=2.4, zorder=5))
    ax.text(x, y, label, ha="center", va="center", fontsize=fs,
            fontproperties=fp, color=color, fontweight="bold", zorder=6)

# ---------- 유스케이스(타원) ----------
cases = {}
def usecase(key, x, y, label, w=2.7, h=1.05, color=RED, fc=None):
    if fc is None:
        fc = TINT.get(color, "#ffffff")
    e = Ellipse((x, y), w, h, facecolor=fc, edgecolor=color, lw=1.8, zorder=3)
    ax.add_patch(e)
    ax.text(x, y, label, ha="center", va="center", fontsize=14.5,
            fontproperties=fp, color=INK, zorder=4)
    cases[key] = (x, y, w, h)

# ---------- 연결선 (점선 «include» 만 유지) ----------
def dashed(from_key, to_key, rad=-0.45, color=GOLD):
    """소스 타원의 오른쪽 → 타깃 타원의 오른쪽으로 우회 곡선(«include»)."""
    fx, fy, fw, fh = cases[from_key]
    tx, ty, tw, th = cases[to_key]
    start = (fx + fw / 2, fy)
    end = (tx + tw / 2, ty)
    arr = FancyArrowPatch(start, end, arrowstyle="-|>",
                          mutation_scale=14, lw=1.3, color=color,
                          linestyle=(0, (5, 3)), zorder=2,
                          shrinkA=4, shrinkB=4,
                          connectionstyle=f"arc3,rad={rad}")
    ax.add_patch(arr)
    ax.text((start[0] + end[0]) / 2 + 1.0, (start[1] + end[1]) / 2,
            "«include»", ha="center", va="center", fontsize=10,
            fontproperties=fp, color=color, style="italic")

# ---------- 시스템 경계 ----------
boundary = FancyBboxPatch((3.6, 0.5), 9.8, 10.4,
                          boxstyle="round,pad=0.02,rounding_size=0.15",
                          facecolor="#fbfbf9", edgecolor=INK, lw=2.2, zorder=0)
ax.add_patch(boundary)
ax.text(8.5, 10.55, "FitCoach 통합 헬스 코칭 시스템", ha="center", va="center",
        fontsize=16.5, fontproperties=fp, color=INK, fontweight="bold")

# ---------- 유스케이스 배치 ----------
colA = 6.0
colB = 11.0
usecase("signup", colA, 9.5, "회원가입")
usecase("login",  colA, 8.2, "로그인")
usecase("profile",colA, 6.9, "프로필·신체정보\n관리")
usecase("program",colA, 5.4, "운동 프로그램\n수행 (자동 증량)")
usecase("form",   colA, 3.9, "AI 자세 분석\n(Form Check)", color=BLUE)
usecase("admin",  colA, 2.3, "데이터 관리", color=GREY)

usecase("meals",  colB, 9.5, "식단 기록\n(Meals)")
usecase("body",   colB, 8.2, "체성분 기록\n(InBody)")
usecase("journal",colB, 6.9, "저널·주간 리포트")
usecase("comm",   colB, 5.4, "커뮤니티\n(글·댓글·좋아요)")
usecase("aiplay", colB, 3.6, "AI 코칭 총평\n생성", color=GOLD)

# ---------- 액터 (원 안에 텍스트, 색 = 담당 역할 원 색) ----------
actor(2.55, 7.0, "사용자", color=RED, fs=16)               # 빨강 역할군 담당
actor(2.55, 2.3, "관리자", color=GREY, fs=16)              # 회색 역할(데이터 관리) 담당
actor(14.6, 3.9, "AI 분석 서버\n(YOLO·MediaPipe)", color=BLUE, fs=11.5)   # Form Check 담당
actor(14.6, 2.0, "Ollama\n(gemma3:4b)", color=GOLD, fs=12.5)        # AI 코칭 총평 담당

# ---------- include 관계 (AI 총평 생성) — 점선 유지 ----------
dashed("meals", "aiplay", rad=-0.55)
dashed("body", "aiplay", rad=-0.45)
dashed("journal", "aiplay", rad=-0.32)

# ---------- 범례 ----------
ax.text(8.5, 0.18,
        "- - ▷ «include» (AI 총평 포함)   ·   액터 원의 색 = 담당 역할(유스케이스) 색",
        ha="center", va="center", fontsize=11.5, fontproperties=fp, color=GREY)

plt.tight_layout()
out = r"C:\Project\FitEating-main\docs\usecase_diagram.png"
plt.savefig(out, dpi=150, bbox_inches="tight", facecolor="white")
print("saved:", out)
