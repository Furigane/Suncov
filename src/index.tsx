import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from 'react-error-boundary';
import { Provider } from 'react-redux';
import '@/app/styles/reset.scss';
import '@/app/styles/index.scss';
import { ErrorComponent } from '@/shared/ui/ErrorComponent';
import { store } from '@/shared/store/config/AppStore';
import { BrowserRouter } from 'react-router-dom';

const container = document.getElementById('root');

const getBasename = () => {
  if (__IS_DEV__) return '/';

  // Prefer explicit base from index.html dataset (for subfolder deploys)
  const ds = (document.body && (document.body as any).dataset) || {};
  const fromDataset = (ds.publicurl || '').toString().trim();
  if (fromDataset) return `/${fromDataset.replace(/^\/+|\/+$/g, '')}`;

  // Default to root for custom domains and standard hosting
  return '/';
};

if (!container) {
  throw new Error('Root element with id="root" not found');
}

const root = createRoot(container);

root.render(
  <BrowserRouter basename={getBasename()}>
    <Provider store={store}>
      <ErrorBoundary fallback={<ErrorComponent />}>
        <App />
      </ErrorBoundary>
    </Provider>
  </BrowserRouter>,
);
