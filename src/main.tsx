import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LoginGate } from './components/LoginGate';
import { SplashCover } from './components/SplashCover';
import { PublicTicketPage } from './components/PublicTicketPage';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Customers report breakdowns at …/RUTECH/#aviso without signing in
const isPublicTicketPage = location.hash.startsWith('#aviso');

createRoot(document.getElementById('root')!).render(
  isPublicTicketPage ? (
    <PublicTicketPage />
  ) : (
    <>
      <SplashCover />
      <LoginGate>
        <App />
      </LoginGate>
    </>
  )
);

// Installable app: offline shell (not available, and not needed, inside Claude)
if ('serviceWorker' in navigator && !(window as any).claude?.use && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
