/* Interactive extras only: every page is fully readable without this file. */

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>';

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

/* Show "Copied", then put the button back as it was. */
function flashCopied(btn) {
  btn._idle ??= btn.innerHTML;
  btn.classList.add('copied');
  btn.innerHTML = CHECK + '<span>Copied</span>';
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = btn._idle;
  }, 1600);
}

document.addEventListener('click', async e => {
  const code = e.target.closest('.copy');
  if (code) {
    await writeClipboard(code.closest('.codeblock').querySelector('pre').innerText);
    flashCopied(code);
    return;
  }
  const page = e.target.closest('.page-copy:not(.ai-trigger)');
  if (page) {
    await writeClipboard(JSON.parse($('#page-markdown').textContent));
    flashCopied(page);
    return;
  }
  const link = e.target.closest('.copy-link');
  if (link) {
    await writeClipboard(link.dataset.url);
    const title = $('.pop-item-title', link);
    title.textContent = 'Copied';
    clearTimeout(link._t);
    link._t = setTimeout(() => { title.textContent = 'Copy link for AI'; }, 1600);
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

/* ---------- Dropdown menus ---------- */
function setupMenu(trigger, popover) {
  const wrapper = trigger.parentElement;
  const items = () => [...popover.querySelectorAll('.pop-item')];

  function open(focusFirst = false) {
    popover.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => popover.classList.add('open'));
    const list = items();
    const target = list.find(a => a.getAttribute('aria-current')) || list[0];
    if (focusFirst && target) target.focus();
  }
  function close(returnFocus = false) {
    if (popover.hidden) return;
    popover.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (trigger.getAttribute('aria-expanded') === 'false') popover.hidden = true; }, 140);
    if (returnFocus) trigger.focus();
  }

  trigger.addEventListener('click', () => (popover.hidden ? open() : close()));
  trigger.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(true);
    }
  });

  popover.addEventListener('keydown', e => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); list.at(-1).focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  });
  // Following a link closes the menu (so it is still closed after "Back").
  // "Copy link" stays open to show that it worked.
  popover.addEventListener('click', e => { if (e.target.closest('a.pop-item')) close(); });

  document.addEventListener('pointerdown', e => {
    if (!popover.hidden && !wrapper.contains(e.target)) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

setupMenu($('#crumb-trigger'), $('#crumb-popover'));
if ($('#ai-trigger')) setupMenu($('#ai-trigger'), $('#ai-popover'));
