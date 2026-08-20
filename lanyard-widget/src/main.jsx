import { createRoot } from 'react-dom/client';
import Lanyard from './Lanyard.jsx';

const STYLES = `
.lanyard-canvas {
  position: relative;
  width: 100%;
  height: 480px;
  display: flex;
  justify-content: center;
  align-items: center;
}
@media (max-width: 720px) {
  .lanyard-canvas {
    height: 360px;
  }
}
`;

function mount() {
  const root = document.getElementById('lanyard-root');
  if (!root) return;

  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);

  createRoot(root).render(
    <Lanyard frontImage="/images/photo_2024-05-19_15-16-22.jpg" />
  );
}

mount();
