// 프리셋 아바타 매니페스트.
// DB(user.avatar) 에는 id("avatar1"…)만 저장하고, 화면에선 id → 이미지로 변환한다.
import a1 from '../assets/avatars/avatar1.png';
import a2 from '../assets/avatars/avatar2.png';
import a3 from '../assets/avatars/avatar3.png';
import a4 from '../assets/avatars/avatar4.png';
import a5 from '../assets/avatars/avatar5.png';
import a6 from '../assets/avatars/avatar6.png';
import a7 from '../assets/avatars/avatar7.png';
import a8 from '../assets/avatars/avatar8.png';
import a9 from '../assets/avatars/avatar9.png';
import a10 from '../assets/avatars/avatar10.png';
import a11 from '../assets/avatars/avatar11.png';
import a12 from '../assets/avatars/avatar12.png';

export const AVATARS = [
  { id: 'avatar1', src: a1 },
  { id: 'avatar2', src: a2 },
  { id: 'avatar3', src: a3 },
  { id: 'avatar4', src: a4 },
  { id: 'avatar5', src: a5 },
  { id: 'avatar6', src: a6 },
  { id: 'avatar7', src: a7 },
  { id: 'avatar8', src: a8 },
  { id: 'avatar9', src: a9 },
  { id: 'avatar10', src: a10 },
  { id: 'avatar11', src: a11 },
  { id: 'avatar12', src: a12 },
];

const MAP = Object.fromEntries(AVATARS.map((a) => [a.id, a.src]));

// 저장된 아바타 id → 이미지 src (없으면 null → 이니셜 폴백).
export const avatarSrc = (id) => (id ? MAP[id] || null : null);
