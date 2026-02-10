// Tailwind CDN configuration
// Kept separate to allow caching and to keep HTML clean
// Note: This file is loaded after the Tailwind CDN script as in the original layout
// to preserve existing behavior.
if (typeof tailwind !== 'undefined') {
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        },
      },
    },
  };
}
