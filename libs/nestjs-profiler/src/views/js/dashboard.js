// Dashboard interactions (requests list)
// Expose toggleSort globally because it's invoked via inline onclick attribute in HTML
window.toggleSort = function toggleSort() {
  const table = document.getElementById('tableBody');
  if (!table) return;
  const rows = Array.from(table.rows);
  rows.reverse().forEach((row) => table.appendChild(row));

  const asc = document.getElementById('sortAsc');
  const desc = document.getElementById('sortDesc');
  if (!asc || !desc) return;

  if (asc.classList.contains('text-indigo-600')) {
    asc.classList.remove('text-indigo-600', 'opacity-100');
    asc.classList.add('opacity-50');
    desc.classList.add('text-indigo-600', 'opacity-100');
    desc.classList.remove('opacity-50');
  } else {
    asc.classList.add('text-indigo-600', 'opacity-100');
    asc.classList.remove('opacity-50');
    desc.classList.remove('text-indigo-600', 'opacity-100');
    desc.classList.add('opacity-50');
  }
};
