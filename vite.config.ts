import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // 💡 GitHub Pages 경로 설정을 위해 'base' 옵션을 추가했습니다.
    // ⚠️ '<저장소이름>' 부분을 실제 GitHub 저장소 이름으로 변경해야 합니다. (예: '/audio-trimmer/')
    base: '/audio-trimmer/', 
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    
    // 💡 'plugins'는 여기에 한 번만 정의했습니다.
    plugins: [react()], 
    
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});