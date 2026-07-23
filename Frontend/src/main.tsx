import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "remixicon/fonts/remixicon.css";
import { Provider } from 'react-redux';
import store from './App/store.tsx'
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

createRoot(document.getElementById('root')!).render(
  <><ToastContainer></ToastContainer>
    <Provider store={store}>
      <App />
    </Provider>
  </>


  ,
)
