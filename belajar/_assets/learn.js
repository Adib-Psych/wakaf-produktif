/* ═══════════════════════════════════════════════
   Belajar SOP — Learning JS
   Progress tracking, note-taking, checklist
   ═══════════════════════════════════════════════ */

const TOPIC_CODE = document.body.dataset.topic || 'unknown';
const STORE_KEY_PREFIX = 'belajar_sop_';

// ─── Note-taking with auto-save ───
function setupReflection() {
  const fields = document.querySelectorAll('textarea[data-reflect]');
  fields.forEach(textarea => {
    const key = `${STORE_KEY_PREFIX}${TOPIC_CODE}_note_${textarea.dataset.reflect}`;
    // Load saved
    const saved = localStorage.getItem(key);
    if (saved) textarea.value = saved;
    // Auto-save (debounced)
    let timer;
    textarea.addEventListener('input', () => {
      clearTimeout(timer);
      const status = textarea.parentElement.querySelector('.save-status');
      if (status) status.textContent = 'menyimpan…';
      timer = setTimeout(() => {
        localStorage.setItem(key, textarea.value);
        if (status) {
          status.textContent = '✓ tersimpan otomatis';
          setTimeout(() => { status.textContent = ''; }, 2000);
        }
      }, 600);
    });
  });
}

// ─── Step checklist with localStorage ───
function setupSteps() {
  const checks = document.querySelectorAll('.step-check');
  checks.forEach(check => {
    const stepId = check.dataset.step;
    const key = `${STORE_KEY_PREFIX}${TOPIC_CODE}_step_${stepId}`;
    // Restore state
    if (localStorage.getItem(key) === 'done') check.classList.add('done');
    // Toggle on click
    check.addEventListener('click', () => {
      check.classList.toggle('done');
      localStorage.setItem(key, check.classList.contains('done') ? 'done' : '');
      updateModuleProgress();
    });
  });
  updateModuleProgress();
}

// ─── Module progress (steps done / total) ───
function updateModuleProgress() {
  const total = document.querySelectorAll('.step-check').length;
  const done = document.querySelectorAll('.step-check.done').length;
  const bar = document.querySelector('.progress-fill');
  if (bar && total > 0) {
    const pct = Math.round((done / total) * 100);
    bar.style.width = pct + '%';
    // Save module completion percentage for landing page
    localStorage.setItem(`${STORE_KEY_PREFIX}progress_${TOPIC_CODE}`, pct);
    // Update displayed counter if present
    const counter = document.querySelector('.progress-counter');
    if (counter) counter.textContent = `${done} / ${total} langkah selesai`;
  }
}

// ─── Last visit timestamp ───
function recordVisit() {
  localStorage.setItem(`${STORE_KEY_PREFIX}lastvisit_${TOPIC_CODE}`, new Date().toISOString());
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  setupReflection();
  setupSteps();
  recordVisit();
});
