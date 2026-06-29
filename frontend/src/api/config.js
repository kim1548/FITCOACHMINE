// src/api/config.js
// 상대경로로 호출 → Vite dev 서버의 proxy가 /api 를 백엔드(localhost:8001)로 전달.
// localhost, 로컬 IP, Cloudflare Tunnel URL 어디서든 동일하게 작동.
import axios from 'axios';

export const API_BASE_URL = '/api/v1';

// 프로그램(/program) 진행 상태 localStorage 키 — 서버 동기화와 공유.
export const PROGRAM_LS_KEY = 'fiteating.program';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// 로그인 계정에 저장된 프로그램 진행 상태를 가져온다. 비로그인/없음/오류면 null.
export async function fetchProgramState() {
  if (!localStorage.getItem('token')) return null;
  try {
    const res = await axios.get(`${API_BASE_URL}/routine/program-state`, { headers: authHeaders() });
    return res.data?.state ?? null;
  } catch {
    return null;
  }
}

// 프로그램 진행 상태를 서버에 저장(업서트). 비로그인이면 조용히 무시 — 로컬 저장은 호출부가 담당.
// 실패해도 로컬 흐름은 막지 않도록 fire-and-forget.
export function pushProgramState(state) {
  if (!localStorage.getItem('token') || !state) return;
  axios.put(
    `${API_BASE_URL}/routine/program-state`,
    { state },
    { headers: authHeaders() },
  ).catch(() => {});
}
