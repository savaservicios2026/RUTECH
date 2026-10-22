import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LoginGate } from './components/LoginGate';
import { SplashCover } from './components/SplashCover';
import { PublicTicketPage } from './components/PublicTicketPage';
import { PublicWorkOrderPage } from './components/PublicWorkOrderPage';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { startAutoUpdate } from './utils/autoUpdate';

// Customers report breakdowns at …/RUTECH/#aviso without signing in
const isPublicTicketPage = location.hash.startsWith('#aviso');
// …and see their signed work order at …/RUTECH/#parte/<código>
const isPublicWorkOrder = location.hash.startsWith('#parte/');

createRoot(document.getElementById('root')!).render(
  isPublicTicketPage ? (
    <PublicTicketPage />
  ) : isPublicWorkOrder ? (
    <PublicWorkOrderPage />

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
  // Logged-in app (not the customers' pages): always run the latest version
  if (!isPublicTicketPage && !isPublicWorkOrder) startAutoUpdate();
}
