// Shared layout interactions: search filter and simple SPA-like navigation
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const attachSearch = () => {
      const searchInput = document.getElementById('search');
      if (!searchInput) return;
      searchInput.addEventListener('input', (e) => {
        const term = String(e.target.value || '').toLowerCase();
        const rows = document.querySelectorAll('tbody tr');
        rows.forEach((row) => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(term) ? '' : 'none';
        });
      });
    };

    attachSearch();

    // SPA Navigation
    const mainContent = document.querySelector('main');
    const navLinks = document.querySelectorAll('nav a');

    const updateActiveLink = (path) => {
      navLinks.forEach((link) => {
        // Reset classes
        link.className =
          'flex items-center px-2 py-2 text-sm font-medium rounded-md group text-slate-300 hover:bg-slate-800 hover:text-white';
        const svg = link.querySelector('svg');
        if (svg)
          svg.setAttribute(
            'class',
            'mr-3 flex-shrink-0 h-6 w-6 text-slate-400 group-hover:text-white'
          );

        // Check match
        const href = link.getAttribute('href');
        if (href === path) {
          link.className =
            'flex items-center px-2 py-2 text-sm font-medium rounded-md group bg-indigo-600 text-white';
          if (svg)
            svg.setAttribute(
              'class',
              'mr-3 flex-shrink-0 h-6 w-6 text-indigo-300'
            );
        }
      });
    };

    // Load and execute any <script> tags inside a container that was injected via innerHTML
    const executeScriptsIn = async (container) => {
      if (!container) return;
      // Track already loaded external scripts to avoid duplicates across navigations
      window.__profilerLoadedScripts = window.__profilerLoadedScripts || new Set();

      const scripts = Array.from(container.querySelectorAll('script'));

      // Load external scripts sequentially to preserve order
      for (const oldScript of scripts) {
        const src = oldScript.getAttribute('src');
        if (src) {
          if (!window.__profilerLoadedScripts.has(src)) {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = src;
              s.onload = () => {
                window.__profilerLoadedScripts.add(src);
                resolve();
              };
              s.onerror = reject;
              document.body.appendChild(s);
            });
          }
        } else if (oldScript.textContent && oldScript.textContent.trim()) {
          // Recreate inline scripts so they execute
          const s = document.createElement('script');
          s.text = oldScript.textContent;
          document.body.appendChild(s);
        }
      }
    };

    const navigate = async (url) => {
      if (!mainContent) {
        window.location.href = url;
        return;
      }
      try {
        // Show loading state if needed
        mainContent.style.opacity = '0.5';

        const response = await fetch(url);
        const text = await response.text();

        // Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // Replace Main Content
        const newMain = doc.querySelector('main');
        const newContent = newMain ? newMain.innerHTML : '';
        mainContent.innerHTML = newContent;
        mainContent.style.opacity = '1';

        // Update Title
        document.title = doc.title;

        // Execute any scripts contained in the newly injected content (page-specific JS)
        await executeScriptsIn(mainContent);

        // Re-attach listeners (like search)
        attachSearch();

        // Update Active State
        updateActiveLink(url);
      } catch (e) {
        console.error('Navigation failed', e);
        window.location.href = url; // Fallback
      }
    };

    document.body.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (
        link &&
        link.href &&
        link.href.includes('/__profiler') &&
        !link.getAttribute('target')
      ) {
        const url = new URL(link.href);
        if (url.origin === window.location.origin) {
          e.preventDefault();
          const path = url.pathname + url.search;
          history.pushState({}, '', path);
          navigate(path);
        }
      }
    });

    window.addEventListener('popstate', () => {
      navigate(window.location.pathname + window.location.search);
    });
  });
})();
