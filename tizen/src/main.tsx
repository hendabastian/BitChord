import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { registerTizenKeys } from './platform/keys';
import { initSpatialNavigation } from './platform/spatialNav';
import { initBridge } from './platform/bridge';
import './styles/tv.css';

// Initialize platform hooks
registerTizenKeys();
initSpatialNavigation();
initBridge();

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

