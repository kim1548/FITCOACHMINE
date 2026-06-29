// 프리셋 아바타 매니페스트.
// DB(user.avatar) 에는 id("male1"…"female3")만 저장하고, 화면에선 id → 이미지로 변환한다.
import m1 from '../assets/avatars/male1.png';
import m2 from '../assets/avatars/male2.png';
import m3 from '../assets/avatars/male3.png';
import f1 from '../assets/avatars/female1.png';
import f2 from '../assets/avatars/female2.png';
import f3 from '../assets/avatars/female3.png';

export const AVATARS = [
  { id: 'male1', src: m1 },
  { id: 'male2', src: m2 },
  { id: 'male3', src: m3 },
  { id: 'female1', src: f1 },
  { id: 'female2', src: f2 },
  { id: 'female3', src: f3 },
];

const MAP = Object.fromEntries(AVATARS.map((a) => [a.id, a.src]));

// 저장된 아바타 id → 이미지 src (없으면 null → 이니셜 폴백).
export const avatarSrc = (id) => (id ? MAP[id] || null : null);
