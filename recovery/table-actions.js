/* Presentation only: retain original action nodes, callbacks and access guards. */
(function () {
  'use strict';
  const selector = '#cashbook-tbody tr > td:last-child, #log-tbody tr > td:last-child';
  function enhance() {
    for (const cell of document.querySelectorAll(selector)) {
      if (cell.querySelector(':scope > .row-actions') || !cell.querySelector(':scope > button')) continue;
      const menu = document.createElement('details');
      menu.className = 'row-actions';
      const trigger = document.createElement('summary');
      trigger.textContent = '⋯';
      trigger.setAttribute('aria-label', 'Opsi baris');
      trigger.title = 'Opsi baris';
      const content = document.createElement('div');
      content.className = 'row-actions-content';
      // Move, never clone: inline callbacks and any existing listeners survive.
      while (cell.firstChild) content.append(cell.firstChild);
      menu.append(trigger, content);
      cell.append(menu);
      trigger.addEventListener('click', event => event.stopPropagation());
      menu.addEventListener('toggle', () => {
        if (menu.open) document.querySelectorAll('.row-actions[open]').forEach(other => {
          if (other !== menu) other.open = false;
        });
      });
      menu.addEventListener('keydown', event => {
        if (event.key === 'Escape') { menu.open = false; trigger.focus(); event.stopPropagation(); }
      });
    }
  }
  function start() {
    enhance();
    const observer = new MutationObserver(enhance);
    for (const id of ['cashbook-tbody', 'log-tbody']) {
      const body = document.getElementById(id);
      if (body) observer.observe(body, {childList: true, subtree: true});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
