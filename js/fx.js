/* ════════════════════════════════════════════
   EFFETS VISUELS PARTAGÉS
════════════════════════════════════════════ */
const Fx = {
  // Pluie de confettis (victoire) ; ne fait rien si les animations sont coupées
  confetti() {
    if (!motionOK()) return;
    const colors = ['#ffd24a', '#5dcaa5', '#f67c5f', '#85b7eb', '#c0dd97', '#f2b179', '#d4537e'];
    const box = document.createElement('div');
    box.className = 'fx-confetti';
    document.body.appendChild(box);
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('div');
      p.className = 'fx-piece';
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.width = 6 + Math.random() * 6 + 'px';
      p.style.height = 8 + Math.random() * 8 + 'px';
      box.appendChild(p);
      const drift = (Math.random() - 0.5) * 240;
      p.animate([
        { transform: 'translate(0, -20px) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + drift + 'px, 105vh) rotate(' + (360 + Math.random() * 540) + 'deg)', opacity: 0.9 }
      ], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 500, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'backwards' });
    }
    setTimeout(() => box.remove(), 4200);
  }
};
