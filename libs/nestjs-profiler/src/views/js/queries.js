// Queries page interactions
document.addEventListener('DOMContentLoaded', () => {
  // Duration Sorting
  const durationHeader = document.getElementById('duration-header');
  const tbody = document.querySelector('tbody');
  let durationAsc = false; // Default is descending (from backend)

  if (durationHeader && tbody) {
    durationHeader.addEventListener('click', () => {
      durationAsc = !durationAsc;
      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        const aNode = a.querySelector('[data-duration]');
        const bNode = b.querySelector('[data-duration]');
        const durA = parseFloat((aNode && aNode.dataset.duration) || '0');
        const durB = parseFloat((bNode && bNode.dataset.duration) || '0');
        return durationAsc ? durA - durB : durB - durA;
      });

      rows.forEach((row) => tbody.appendChild(row));

      // Update Arrow indication
      const arrow = durationHeader.querySelector('span');
      if (arrow) arrow.textContent = durationAsc ? '↑' : '↓';
    });
  }
});
