import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { MesHubProvider } from './context/MesHubContext.jsx';
import { SimulationStatusProvider } from './context/SimulationStatusContext.jsx';
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <NotificationProvider>
          <AuthProvider>
            <SimulationStatusProvider>
              <MesHubProvider>
                <App />
              </MesHubProvider>
            </SimulationStatusProvider>
          </AuthProvider>
        </NotificationProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </StrictMode>
);
