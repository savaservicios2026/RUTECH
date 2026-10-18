import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LoginGate } from './components/LoginGate';
import { SplashCover } from './components/SplashCover';
import 'leaflet/dist/leaflet.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <SplashCover />
    <LoginGate>
      <App />
    </LoginGate>
  </>
);

// Installable app: offline shell (not available, and not needed, inside Claude)
if ('serviceWorker' in navigator && !(window as any).claude?.use && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
