import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import './Landing.gleap.css';

// "그리고 더 많은 기능" 목록 — 게스트가 클릭해 각 기능을 구경할 수 있게 라우트 매핑.
// to: null 인 항목(PWA 설치)은 대응 페이지가 없어 비링크로 둔다.
const MORE_FEATURES = [
  { label: 'AI 폼체크 (5축 · 18종)', to: '/formcheck', on: true },
  { label: '운동 프로그램 10종 · 자동 증량', to: '/program' },
  { label: '식단 사진 AI 인식 · 매크로', to: '/meals' },
  { label: '체성분(인바디) 추이 · AI 코멘트', to: '/body' },
  { label: '통합 저널 · 주간 리포트', to: '/journal' },
  { label: '커뮤니티 · 운동 메이트', to: '/community' },
  { label: '영양제 맞춤 추천', to: '/supplement' },
  { label: '모바일 PWA 설치', to: null },
];

/**
 * / — 비로그인 표지 (Gleap 라이트 에디토리얼).
 * 스타일은 Landing.gleap.css 에서 .gleap 스코프로 격리(다크 제품 페이지 영향 없음).
 * 모션 3종: ① 스크롤 시 네비 검정 알약 변형 ② 히어로 카드 3D→평면 ③ 섹션 리빌.
 * prefers-reduced-motion 시 전부 비활성 + 최종 상태 고정.
 */
const Landing = () => {
  usePageTitle('FitCoach — AI 헬스 코칭');

  const navigate = useNavigate();
  const rootRef = useRef(null);
  const navRef = useRef(null);
  const previewRef = useRef(null);
  const previewWrapRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ③ 섹션 리빌 (스크롤 컨테이너 = root)
    const reveals = root.querySelectorAll('.reveal');
    let io;
    if (!reduce) {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        }),
        { root, threshold: 0.12 }
      );
      reveals.forEach((el) => io.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add('in'));
    }

    // ① 네비 알약 + ② 히어로 카드 틸트
    const onScroll = () => {
      const nav = navRef.current;
      if (nav) nav.classList.toggle('floating', root.scrollTop > 80);

      const pv = previewRef.current;
      const pw = previewWrapRef.current;
      if (!pv || !pw) return;
      if (reduce || window.innerWidth <= 900) { pv.style.transform = 'none'; return; }
      const r = pw.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, 1 - (r.top + r.height * 0.2) / window.innerHeight));
      pv.style.transform = `rotateX(${(1 - p) * 20}deg) scale(${0.965 + p * 0.035})`;
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    // 인페이지 앵커(#feat·#cmp·#more 등) — .gleap 이 fixed 스크롤 컨테이너라
    // 브라우저 기본 해시 점프가 동작하지 않으므로, 컨테이너를 직접 스크롤한다.
    const NAV_OFFSET = 76; // 고정 네비 높이 보정
    const onAnchorClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute('href');
      e.preventDefault();
      if (!href || href === '#') {
        root.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        return;
      }
      const target = root.querySelector(href);
      if (!target) return;
      const top = Math.max(0, target.offsetTop - NAV_OFFSET);
      root.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    };
    root.addEventListener('click', onAnchorClick);

    return () => {
      if (io) io.disconnect();
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      root.removeEventListener('click', onAnchorClick);
    };
  }, []);

  return (
    <div className="gleap" ref={rootRef}>
      {/* NAV */}
      <nav ref={navRef}>
        <div className="navinner">
          <Link to="/" className="brand"><span className="mark" /><span className="txt">FitCoach</span></Link>
          <div className="menu">
            <a href="#feat">기능</a><a href="#cmp">왜 FitCoach</a><a href="#more">둘러보기</a>
          </div>
          <div className="navright">
            <Link className="login" to="/login">로그인</Link>
            <Link className="signup" to="/signup">무료로 시작</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap">
          <span className="pill reveal">AI 자세분석 · 통합 헬스 코칭</span>
          <h1 className="reveal">혼자 들어도, <em>제대로.</em></h1>
          <p className="sub reveal">운동 프로그램·AI 자세분석·식단·체성분을 한 곳에서. 영상만 올리면 5축으로 폼을 진단하고, 기록은 저널로 쌓입니다.</p>
          <div className="cta-row reveal">
            <Link className="btn dark" to="/login">데모 보기</Link>
            <Link className="btn lilac" to="/signup">무료로 시작 →</Link>
          </div>
          <p className="metacap reveal">PT 없이 · 영상 업로드로 · 5축 폼 진단</p>
        </div>
        <div className="previewWrap wrap" ref={previewWrapRef}>
          <div className="preview" ref={previewRef}>
            <div className="screen">
              <aside className="sb">
                <div className="si on">Form Check</div>
                <div className="si">Program</div><div className="si">Meals</div>
                <div className="si">Body</div><div className="si">Journal</div><div className="si">Community</div>
              </aside>
              <div className="center">
                <div className="eyebrow">스쿼트 · 자세 리포트</div>
                <div className="kpi">82<span style={{ fontSize: 20, color: 'var(--slate)' }}> / 100</span></div>
                <div className="axis">
                  <div className="row">안정성 <div className="bar"><i style={{ width: '88%' }} /></div> 88</div>
                  <div className="row">가동범위 <div className="bar"><i style={{ width: '74%' }} /></div> 74</div>
                  <div className="row">동작품질 <div className="bar"><i style={{ width: '80%' }} /></div> 80</div>
                  <div className="row">자세 <div className="bar"><i style={{ width: '69%' }} /></div> 69</div>
                  <div className="row">코어 <div className="bar"><i style={{ width: '85%' }} /></div> 85</div>
                </div>
              </div>
              <div className="detail">
                <h4>교정 피드백</h4>
                <span className="tag">무릎 모임</span><span className="tag">상체 숙임</span>
                <p style={{ fontSize: 13, color: 'var(--graphite)', marginTop: 8 }}>하강 시 무릎이 살짝 안으로 모입니다. 발끝과 무릎 방향을 맞춰보세요.</p>
              </div>
            </div>
            <div className="chat"><b>AI 코치 👋</b><p>오늘 스쿼트 폼, 무릎이 살짝 안으로 모였어요. 다음 세트에서 바깥으로 밀어볼까요?</p></div>
          </div>
        </div>
      </header>

      {/* FEATURE 2UP */}
      <section id="feat">
        <div className="wrap">
          <div className="center-head reveal"><span className="pill">하나의 플랫폼</span>
            <h2>운동에 필요한 모든 것을, 한 화면에서</h2></div>
          <div className="two">
            <div className="fcard sky reveal">
              <div className="eyebrow">자세를 봐주는 AI</div>
              <h3>영상만 올리면, 폼을 진단합니다</h3>
              <p>YOLO + MediaPipe로 관절을 추적해 안정성·가동범위·동작품질·자세·코어 5축으로 점수와 교정 피드백을 줍니다. PT 없이도 내 자세를 객관적으로 확인하세요.</p>
              <Link className="lnk" to="/signup">자세히 →</Link>
              <div className="miniaxis">
                <div className="row">안정성 <div className="bar"><i style={{ width: '88%' }} /></div></div>
                <div className="row">가동범위 <div className="bar"><i style={{ width: '74%' }} /></div></div>
                <div className="row">자세 <div className="bar"><i style={{ width: '69%' }} /></div></div>
              </div>
            </div>
            <div className="fcard paper reveal">
              <div className="eyebrow">흩어질 필요 없이</div>
              <h3>운동·식단·체성분을 한 곳에서</h3>
              <p>검증된 프로그램으로 들고, 사진으로 식단을 채우고, 인바디로 변화를 확인합니다. 하루의 모든 기록은 저널 하나로 묶입니다.</p>
              <Link className="lnk" to="/signup">자세히 →</Link>
              <div className="avatars">
                <span className="av"><span className="dot" />프로그램 10종</span>
                <span className="av"><span className="dot" style={{ background: 'var(--sky)' }} />식단 매크로</span>
                <span className="av"><span className="dot" style={{ background: 'var(--lilac-deep)' }} />인바디 추이</span>
                <span className="av"><span className="dot" />저널 · 커뮤니티</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section id="cmp" style={{ background: 'var(--bone)' }}>
        <div className="wrap">
          <div className="center-head reveal"><span className="pill lilac">왜 FitCoach</span>
            <h2>여러 앱 대신, FitCoach 하나로.</h2>
            <p>폼체크·프로그램·식단·인바디를 따로 쓰지 않아도 됩니다.</p></div>
          <div className="cmp reveal">
            <div className="r head"><div className="c lab" /><div className="c col-hi">FitCoach</div><div className="c">따로 쓰는 앱들</div></div>
            <div className="r"><div className="c lab">AI 폼체크(5축)</div><div className="c col-hi"><span className="ic">✓</span></div><div className="c">폼체크 전용앱</div></div>
            <div className="r"><div className="c lab">운동 프로그램·자동 증량</div><div className="c col-hi"><span className="ic">✓</span></div><div className="c">프로그램 앱</div></div>
            <div className="r"><div className="c lab">식단·매크로 기록</div><div className="c col-hi"><span className="ic">✓</span></div><div className="c">식단 앱</div></div>
            <div className="r"><div className="c lab">체성분 추이</div><div className="c col-hi"><span className="ic">✓</span></div><div className="c">인바디 앱</div></div>
            <div className="r"><div className="c lab">통합 저널</div><div className="c col-hi"><span className="ic">✓</span></div><div className="c x"><span className="ic">✕</span></div></div>
            <div className="r"><div className="c lab">로컬 AI(데이터 외부전송 없음)</div><div className="c col-hi"><span className="ic">✓</span></div><div className="c x"><span className="ic">✕</span></div></div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section>
        <div className="wrap">
          <div className="center-head reveal"><span className="pill">후기</span><h2>먼저 써본 사람들의 이야기</h2></div>
          <div className="tgrid">
            <div className="tcard reveal"><p>"PT 없이도 데드리프트 폼을 영상으로 점검할 수 있어요. 5축 점수가 직관적이라 어디를 고칠지 바로 압니다."</p>
              <div className="who"><span className="a">현</span><div><b>김현우</b><span>헬스 3년차</span></div></div></div>
            <div className="tcard reveal"><p>"운동·식단·인바디를 앱 세 개 오가며 봤는데, 이제 한 곳에서 다 끝나요. 저널로 묶이는 게 제일 좋아요."</p>
              <div className="who"><span className="a">지</span><div><b>이지민</b><span>직장인 · 다이어트</span></div></div></div>
            <div className="tcard reveal"><p>"프로그램이 성공하면 자동으로 무게를 올려줘서, 저는 그냥 기록만 하면 됩니다. 입문자한테 딱이에요."</p>
              <div className="who"><span className="a">서</span><div><b>박서준</b><span>운동 입문 2개월</span></div></div></div>
          </div>
        </div>
      </section>

      {/* FEATURE LIST + DUSK */}
      <section id="more">
        <div className="wrap">
          <div className="center-head reveal" style={{ textAlign: 'left', marginBottom: 40 }}><span className="pill">기능</span><h2>그리고 더 많은 기능</h2></div>
          <div className="flist">
            <ul className="reveal">
              {MORE_FEATURES.map((f) => (
                <li
                  key={f.label}
                  className={f.on ? 'on' : ''}
                  onClick={f.to ? () => navigate(f.to) : undefined}
                  onKeyDown={f.to ? (e) => { if (e.key === 'Enter') navigate(f.to); } : undefined}
                  role={f.to ? 'link' : undefined}
                  tabIndex={f.to ? 0 : undefined}
                  style={f.to ? { cursor: 'pointer' } : undefined}
                >
                  {f.label}
                </li>
              ))}
            </ul>
            <div className="shotDusk reveal">
              <div className="card">
                <h5>주간 리포트 · AI 총평</h5>
                <div className="b"><i style={{ width: '82%' }} /></div>
                <div className="b"><i style={{ width: '64%' }} /></div>
                <div className="b"><i style={{ width: '90%' }} /></div>
                <p style={{ fontSize: 12, color: 'var(--graphite)', marginTop: 8 }}>이번 주 볼륨 +12%, 스쿼트 폼 점수가 74→82로 올랐어요.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CINEMATIC CTA + FOOTER */}
      <section className="cine">
        <svg className="mountains" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,220 L0,150 L240,70 L470,160 L700,60 L980,170 L1230,90 L1440,160 L1440,220 Z" fill="#39404f" opacity=".85" />
          <path d="M0,220 L0,185 L300,120 L560,190 L850,120 L1140,200 L1440,140 L1440,220 Z" fill="#2b3140" opacity=".9" />
        </svg>
        <div className="inner">
          <div style={{ textAlign: 'center' }}><span className="pill reveal">AI 헬스 코칭</span></div>
          <h2 className="reveal">오늘의 운동을,<br />데이터로 남기세요.</h2>
          <p className="sub reveal">영상 한 번, 5축 진단. 기록이 쌓일수록 코칭은 더 정교해집니다.</p>
          <div className="ctac reveal"><Link className="btn lilac" to="/signup">무료로 시작하기 →</Link></div>

          <footer className="foot">
            <div>
              <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 20 }}><span className="mark" />FitCoach</div>
              <p className="tag">운동·자세분석·식단·체성분을 하나로 묶은 AI 헬스 코칭. 모바일/웹.</p>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>© 이미지 연구소</div>
            </div>
            <div><h6>제품</h6><a href="#feat">폼체크</a><a href="#feat">운동 프로그램</a><a href="#feat">식단</a><a href="#feat">체성분</a><a href="#more">커뮤니티</a></div>
            <div><h6>리소스</h6><a href="#more">사용 가이드</a><a href="#more">문서</a><a href="#more">블로그</a><a href="#more">PWA 설치</a></div>
            <div><h6>팀 · 이미지 연구소</h6><a href="#">김용진</a><a href="#">안민기</a><a href="#">서기철</a><a href="#cmp">소개</a></div>
          </footer>
        </div>
      </section>
    </div>
  );
};

export default Landing;
