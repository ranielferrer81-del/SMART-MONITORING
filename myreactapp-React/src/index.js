import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';

// Background is CSS gradients in index.css (avoids 404 on missing /Image1.jpg in production)

// Create overlay element
const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.top = '0';
overlay.style.left = '0';
overlay.style.right = '0';
overlay.style.bottom = '0';
overlay.style.background = 'rgba(15, 23, 42, 0.2)';
overlay.style.zIndex = '-1';
overlay.id = 'background-overlay';
document.body.appendChild(overlay);

// Update overlay for dark mode
const updateOverlay = () => {
  const isDark = document.documentElement.classList.contains('dark');
  overlay.style.background = isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(15, 23, 42, 0.2)';
};

// Watch for dark mode changes
const observer = new MutationObserver(updateOverlay);
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class']
});

// Unregister any existing service workers from previous projects
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
