import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { getCachedFilters } from './filters-cache.ts';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App
      lockfilesUrl={window.lockfilesUrl}
      baseRepoUrl={window.baseRepoUrl}
      defaultSelectedRepos={getCachedFilters()}
      defaultQuery={new URLSearchParams(window.location.search).get('q') || ''}
    />
  </React.StrictMode>
);
