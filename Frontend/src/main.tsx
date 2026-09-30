import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "remixicon/fonts/remixicon.css";
import { Provider } from 'react-redux';
import store from './App/store.tsx'
import Toaster from './component/ui/Toaster';

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
    {/* Mounted once, inside the Provider, so any component can raise a toast. */}
    <Toaster />
  </Provider>
)
