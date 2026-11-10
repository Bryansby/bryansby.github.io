(() => {
  const main = document.querySelector('main');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!main || reducedMotion.matches || !('IntersectionObserver' in window)) return;

  const root = document.documentElement;
  const copies = [];
  const groups = new Map();
  let resizeFrame;

  const reveal = (elements, delay = 0, immediate = false) => {
    elements.forEach(element => {
      element.style.setProperty('--reveal-delay', `${delay}ms`);
      if (immediate) element.classList.add('reveal-immediate');
      element.classList.add('is-revealed');
    });
  };

  // Observe one word per rendered line, so a long paragraph reveals a row
  // at a time as it enters the viewport, including after mobile reflow.
  const observer = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      .forEach((entry, index) => {
        reveal(groups.get(entry.target) || [entry.target], Math.min(index * 65, 260));
        observer.unobserve(entry.target);
        groups.delete(entry.target);
      });
  }, { rootMargin: '0px 0px -32px 0px', threshold: 0 });

  const blocks = [...main.querySelectorAll(
    'h1, h2, h3, .eyebrow, .entry-meta, .profile-links, .project-links, ' +
    '.simple-list > li, .interest-grid > li, .contact-row, ' +
    '.news-row > time, .profile-portrait, .research-photo > img, ' +
    '.event-photo > img, .tennis-carousel'
  )].filter(element => !element.parentElement.closest('.contact-row, .tennis-carousel'));

  const showAll = () => {
    observer.disconnect();
    groups.clear();
    cancelAnimationFrame(resizeFrame);
    root.classList.remove('scroll-reveals');
  };

  try {
    main.querySelectorAll('p:not(.eyebrow):not(.project-links)').forEach(paragraph => {
      if (paragraph.closest('.contact-row, .tennis-carousel')) return;
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      const words = [];
      textNodes.forEach(node => {
        const fragment = document.createDocumentFragment();
        // Keep whitespace and inline links/language annotations intact.
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            fragment.append(document.createTextNode(part));
          } else {
            const word = document.createElement('span');
            word.className = 'reveal-word';
            word.textContent = part;
            words.push(word);
            fragment.append(word);
          }
        });
        node.replaceWith(fragment);
      });
      paragraph.classList.add('reveal-copy');
      copies.push(words);
    });

    blocks.forEach(element => {
      element.dataset.reveal = element.matches('.profile-portrait, img, .tennis-carousel')
        ? 'image' : 'block';
    });

    const observeLines = () => {
      observer.disconnect();
      groups.clear();
      blocks.filter(element => !element.classList.contains('is-revealed'))
        .forEach(element => observer.observe(element));

      copies.forEach(words => {
        const lines = new Map();
        words.forEach(word => {
          // offsetTop ignores animation transforms, keeping rows stable.
          const top = word.offsetTop;
          if (!lines.has(top)) lines.set(top, []);
          lines.get(top).push(word);
        });
        lines.forEach(line => {
          const pending = line.filter(word => !word.classList.contains('is-revealed'));
          if (!pending.length) return;
          if (pending.length !== line.length) {
            reveal(pending, 0, true);
          } else {
            groups.set(line[0], line);
            observer.observe(line[0]);
          }
        });
      });
    };

    const revealWithin = target => {
      if (!(target instanceof Element)) return;
      const container = target.closest('.reveal-copy, [data-reveal]') || target;
      reveal([container, ...container.querySelectorAll('.reveal-word, [data-reveal]')], 0, true);
    };
    const revealAnchor = () => {
      try {
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (id) revealWithin(document.getElementById(id));
      } catch { /* An invalid URL fragment must not interrupt the page. */ }
    };

    observeLines();
    root.classList.add('scroll-reveals');
    revealAnchor();
    // Focused links and anchor destinations should be readable immediately.
    main.addEventListener('focusin', event => revealWithin(event.target));
    window.addEventListener('hashchange', revealAnchor);
    window.addEventListener('resize', () => {
      if (!root.classList.contains('scroll-reveals')) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(observeLines);
    }, { passive: true });
    reducedMotion.addEventListener('change', event => {
      if (event.matches) showAll();
    });
  } catch {
    // Content stays readable if enhancement cannot be initialized.
    showAll();
  }
})();
