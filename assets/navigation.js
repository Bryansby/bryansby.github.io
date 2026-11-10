(() => {
  const nav = document.getElementById('site-nav');
  const current = nav?.querySelector('[aria-current="page"]');
  if (!current || typeof Element.prototype.animate !== 'function') return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pill = document.createElement('span');
  pill.className = 'section-pill';
  pill.setAttribute('aria-hidden', 'true');
  nav.prepend(pill);
  let motion;

  const position = element => {
    const track = nav.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const x = rect.left - track.left + nav.scrollLeft;
    const y = rect.top - track.top + nav.scrollTop;
    return { transform: `translate(${x}px, ${y}px)`, width: `${rect.width}px`, height: `${rect.height}px` };
  };

  const reset = () => {
    motion?.cancel();
    motion = null;
    nav.classList.remove('is-sliding');
  };

  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || link.target || link.hasAttribute('download') ||
        link.origin !== window.location.origin || reducedMotion.matches) return;

    if (link === current) {
      if (motion) {
        event.preventDefault();
        reset();
      }
      return;
    }

    // If another link was clicked mid-glide, start from the pill's current position.
    const from = position(motion ? pill : current);
    const to = position(link);
    motion?.cancel();
    nav.classList.add('is-sliding');
    const animation = pill.animate([from, to], {
      duration: 280,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'forwards',
    });
    motion = animation;
    event.preventDefault();
    animation.onfinish = () => {
      if (motion === animation) window.location.assign(link.href);
    };
  });

  window.addEventListener('pageshow', event => {
    if (event.persisted) reset();
  });
})();
