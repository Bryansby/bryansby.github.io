(() => {
  const main = document.querySelector('main');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!main || reducedMotion.matches) return;

  const root = document.documentElement;
  const copies = [];
  let groups = [];
  let frame = 0;
  let needsMeasure = true;

  const blocks = [...main.querySelectorAll(
    'h1, h2, h3, .eyebrow, .entry-meta, .profile-links, .project-links, ' +
    '.simple-list > li, .interest-grid > li, .contact-row, ' +
    '.news-row > time, .profile-portrait, .research-photo > img, ' +
    '.event-photo > img, .tennis-carousel'
  )].filter(element => !element.parentElement.closest('.contact-row, .tennis-carousel'));

  // Layout offsets stay fixed as the reveal moves the painted content.
  const pageTop = element => {
    let top = element.offsetTop;
    for (let parent = element.offsetParent; parent; parent = parent.offsetParent) {
      top += parent.offsetTop + parent.clientTop;
    }
    return top;
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

    const measure = () => {
      const height = root.clientHeight;
      const bottom = Math.max(0, root.scrollHeight - height);
      const rangeFor = elements => {
        const first = elements[0];
        const entry = pageTop(first) - height;
        const distance = first.dataset.reveal === 'image'
          ? Math.min(220, height * .28)
          : Math.min(120, height * .18);
        // Leave the first screen readable and finish every reveal by page end.
        const end = entry <= 0 ? 0 : Math.min(entry + distance, bottom);
        return { elements, start: Math.min(entry, end - 1), end, progress: null };
      };

      groups = blocks.map(element => rangeFor([element]));

      copies.forEach(words => {
        const lines = new Map();
        words.forEach(word => {
          const top = word.offsetTop;
          if (!lines.has(top)) lines.set(top, []);
          lines.get(top).push(word);
        });
        lines.forEach(line => groups.push(rangeFor(line)));
      });
    };

    const render = () => {
      frame = 0;
      if (reducedMotion.matches) return;
      if (needsMeasure) {
        measure();
        needsMeasure = false;
      }

      const scroll = Math.max(0, window.scrollY);
      groups.forEach(group => {
        const fraction = Math.min(1, Math.max(0, (scroll - group.start) / (group.end - group.start)));
        const progress = 1 - (1 - fraction) ** 2;
        if (progress === group.progress) return;
        group.progress = progress;
        group.elements.forEach(element => {
          element.classList.toggle('is-revealing', progress < 1);
          element.style.setProperty('--reveal-progress', progress);
        });
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const remeasure = () => {
      needsMeasure = true;
      schedule();
    };

    render();
    root.classList.add('scroll-reveals');
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    window.addEventListener('pageshow', remeasure);
    reducedMotion.addEventListener('change', remeasure);
    if ('ResizeObserver' in window) {
      const layout = new ResizeObserver(remeasure);
      layout.observe(main);
      layout.observe(document.body);
    }
  } catch {
    // Content stays readable if enhancement cannot be initialized.
    root.classList.remove('scroll-reveals');
  }
})();
