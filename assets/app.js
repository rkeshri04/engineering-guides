/* Interactive extras only: every page is fully readable without this file. */

const ICON = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>',
};

const $ = (sel, root = document) => root.querySelector(sel);

/* ---------- Clipboard ---------- */
async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
}

function flashCopied(btn, idleLabel) {
  btn.classList.add('copied');
  btn.innerHTML = ICON.check + '<span>Copied</span>';
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = ICON.copy + `<span>${idleLabel}</span>`;
  }, 1600);
}

document.addEventListener('click', async e => {
  const code = e.target.closest('.copy');
  if (code) {
    await writeClipboard(code.closest('.codeblock').querySelector('pre').innerText);
    flashCopied(code, 'Copy');
    return;
  }
  const page = e.target.closest('.page-copy');
  if (page) {
    await writeClipboard(JSON.parse($('#page-markdown').textContent));
    flashCopied(page, 'Copy page');
    return;
  }
  if (e.target.closest('[data-top]')) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

/* ---------- Table of contents + scroll progress ---------- */
const progress = $('#progress');
const tocLinks = [...document.querySelectorAll('#toc a')];
const tocSections = tocLinks.map(a => document.getElementById(a.getAttribute('href').slice(1)));

function onScroll() {
  if (tocSections.length) {
    const y = window.scrollY + 120;
    let current = tocSections[0];
    tocSections.forEach(s => { if (s.offsetTop <= y) current = s; });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = tocSections.at(-1);
    tocLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current.id));
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Breadcrumb dropdown ---------- */
const trigger = $('#crumb-trigger');
const popover = $('#crumb-popover');
const items = () => [...popover.querySelectorAll('.pop-item')];

function openMenu(focusFirst = false) {
  popover.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => popover.classList.add('open'));
  const list = items();
  const target = list.find(a => a.getAttribute('aria-current')) || list[0];
  if (focusFirst && target) target.focus();
}
function closeMenu(returnFocus = false) {
  if (popover.hidden) return;
  popover.classList.remove('open');
  trigger.setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (trigger.getAttribute('aria-expanded') === 'false') popover.hidden = true; }, 140);
  if (returnFocus) trigger.focus();
}

trigger.addEventListener('click', () => (popover.hidden ? openMenu() : closeMenu()));
trigger.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openMenu(true);
  }
});

popover.addEventListener('keydown', e => {
  const list = items();
  const i = list.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
  else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
  else if (e.key === 'End') { e.preventDefault(); list.at(-1).focus(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
  else if (e.key === 'Tab') closeMenu();
});
// Choosing an item closes the menu, so it is closed again after "Back".
popover.addEventListener('click', e => { if (e.target.closest('.pop-item')) closeMenu(); });

document.addEventListener('pointerdown', e => {
  if (!popover.hidden && !e.target.closest('#crumb-menu')) closeMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
