// Date et heure du mariage : modifiez l'heure si nécessaire.
const weddingDate = new Date('2027-09-18T00:00:00+02:00').getTime();
function updateCountdown(){
  const remaining = Math.max(0, weddingDate - Date.now());
  const values = {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining / 3600000) % 24),
    minutes: Math.floor((remaining / 60000) % 60),
    seconds: Math.floor((remaining / 1000) % 60)
  };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).textContent = String(value).padStart(2, '0');
}
updateCountdown();
setInterval(updateCountdown, 1000);
const menuButton = document.querySelector('.menu-toggle');
const nav = document.getElementById('site-nav');
menuButton.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded','false');
  menuButton.setAttribute('aria-label','Ouvrir le menu');
}));
