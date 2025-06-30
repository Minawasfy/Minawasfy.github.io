const desktopBtn = document.getElementById('desktopBtn');
const mobileBtn = document.getElementById('mobileBtn');
const viewport = document.getElementById('viewport');

desktopBtn.onclick = () => {
  document.body.classList.remove('mobile-mode');
  document.body.classList.add('desktop-mode');
};

mobileBtn.onclick = () => {
  document.body.classList.remove('desktop-mode');
  document.body.classList.add('mobile-mode');
};