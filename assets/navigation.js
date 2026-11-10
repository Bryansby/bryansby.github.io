(() => {
  const toggle = document.querySelector('.nav-toggle');
  if (!toggle) return;

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const setOpen = open => toggle.setAttribute('aria-expanded', String(open));
  toggle.addEventListener('click', () => setOpen(!isOpen()));
  toggle.closest('header').addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen() && toggle.getClientRects().length) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.addEventListener('pageshow', () => setOpen(false));
  toggle.hidden = false;
})();
