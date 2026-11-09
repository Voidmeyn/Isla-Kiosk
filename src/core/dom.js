// Tiny DOM helpers — no framework, so the kiosk has zero runtime dependencies.

/**
 * h('button', { class: 'btn', onClick: fn, 'aria-label': 'x' }, 'Text', child, [more])
 * - `class` accepts a string or an array (falsy entries ignored)
 * - `on<Event>` attaches listeners
 * - `style` accepts a string or object
 * - `html` sets innerHTML (only use with trusted, static markup such as icons)
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value' && 'value' in el) el.value = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Replace all children of `el`. */
export function mount(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/** Inline SVG from a markup string (trusted, bundled icons only). */
export function svg(markup, className) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  const node = tpl.content.firstElementChild;
  if (className) node.setAttribute('class', className);
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  return node;
}

/** Fire `fn` on a long press (staff/admin gestures). Returns a cleanup fn. */
export function onLongPress(el, ms, fn) {
  let timer = null;
  const start = () => { clear(); timer = setTimeout(fn, ms); };
  const clear = () => { if (timer) clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, clear));
  return clear;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
