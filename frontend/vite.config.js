import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true, type: 'module' },
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'apple-touch-icon-180.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
      ],
      manifest: {
        name: 'FitCoach — 매일의 strength 저널',
        short_name: 'FitCoach',
        description:
          'FitCoach — 운동·식단·체성분 기록이 한 권의 매거진처럼 쌓이는 헬스 코칭 트래커.',
        lang: 'ko',
        theme_color: '#14110d',
        background_color: '#14110d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        // 알림 클릭 시 앱 열기 핸들러를 생성된 서비스워커에 주입
        importScripts: ['/sw-custom.js'],
      },
    }),
  ],
  optimizeDeps: {
    // Mediapipe가 Vite의 의존성 분석 시스템을 통과하지 못하게 아예 제외시킵니다.
    exclude: ['@mediapipe/pose', '@mediapipe/camera_utils'],
  },
  // 브라우저에서 'module'을 찾지 못할 때를 대비한 별칭 설정
  resolve: {
    alias: {
      '@mediapipe/pose': '@mediapipe/pose/pose.js',
      '@mediapipe/camera_utils': '@mediapipe/camera_utils/camera_utils.js',
    },
  },
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:8001',
    },
  },
  // 프로덕션 빌드 미리보기(폰 PWA 데모용) — dev 와 동일하게 터널 허용 + API 프록시
  preview: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:8001',
    },
  },
});