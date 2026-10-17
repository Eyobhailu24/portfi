(() => {
  if (window.__portfiMotion) return;
  window.__portfiMotion = true;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let seen = new WeakSet();
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08 }) : null;
  const scan = () => {
    if (preference.matches || !observer) return;
    document.querySelectorAll('.folio-section[data-motion]').forEach(section => {
      if (seen.has(section)) return;
      seen.add(section);
      section.closest('.folio')?.classList.add('folio-motion-enabled');
      if (section.dataset.trigger === 'load') section.classList.add('is-visible');
      else observer.observe(section);
    });
  };
  const replay = () => {
    observer?.disconnect();
    seen = new WeakSet();
    document.querySelectorAll('.folio-section.is-visible').forEach(section => section.classList.remove('is-visible'));
    requestAnimationFrame(scan);
  };
  scan();
  window.addEventListener('portfi:replay', replay);
  preference.addEventListener('change', replay);
  // The observer also discovers sections rendered by client-side navigation.
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
