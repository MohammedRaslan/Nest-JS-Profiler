// Entities page interactions
// Expose toggleEntityRow globally because it is invoked from HTML
window.toggleEntityRow = function toggleEntityRow(id) {
  const row = document.getElementById(id);
  const icon = document.getElementById('icon-' + id);
  const contentDiv = document.getElementById('content-' + id);

  if (!row || !icon) return;

  // Toggle visibility
  if (row.classList.contains('hidden')) {
    row.classList.remove('hidden');
    icon.classList.add('rotate-90');

    // Populate if empty (lazy render)
    if (contentDiv && contentDiv.children.length === 0) {
      try {
        const columns = JSON.parse(row.dataset.columns || '[]');
        if (columns.length === 0) {
          contentDiv.innerHTML = '<span class="text-gray-400 italic">No columns defined</span>';
        } else {
          contentDiv.innerHTML = columns
            .map(
              (col) =>
                `<div class="bg-white px-2 py-1 rounded border border-gray-200 truncate" title="${col}">${col}</div>`
            )
            .join('');
        }
      } catch (e) {
        console.error('Error parsing columns', e);
      }
    }
  } else {
    row.classList.add('hidden');
    icon.classList.remove('rotate-90');
  }
};
