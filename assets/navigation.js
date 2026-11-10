(() => {
  const nav = document.getElementById('site-nav');
  const current = nav?.querySelector('[aria-current="page"]');
  const pill = current?.querySelector('.section-pill');
  if (!pill) return;

  if ('onpagereveal' in window) {
    // Let the browser animate both the content and pill, including history navigation.
    nav.classList.add('has-page-transitions');
    return;
  }

  // Keep the click glide in browsers without cross-page transitions.
  if (typeof Element.prototype.animate !== 'function') return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
