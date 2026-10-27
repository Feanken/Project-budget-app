// Only add the CSRF defense header to same-origin API requests.
(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input, window.location.href);
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/') &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      headers.set('X-Requested-With', 'XMLHttpRequest');
      return originalFetch(input, { ...init, headers });
    }
    return originalFetch(input, init);
  };
})();
