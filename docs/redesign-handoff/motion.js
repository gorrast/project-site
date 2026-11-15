/*
 * wigh.nu motion — one file every page loads.
 * Ported from DH2465 components/ui/Motion.tsx, without React/GSAP:
 *   calmTransition  0.6s cubic-bezier(.22,.61,.36,1)
 *   RevealHeading   masked line rise, yPercent 110 → 0, 1.2s, power3.out
 *   RevealSection   below-the-fold sections fade + rise 28px, 1s, once, -8% bottom margin
 *   MetricGroup     children fade + rise 16px, 0.11s stagger
 *   ActionButton    hover 1.035 / press 0.965, 0.26s (CSS in each page's <style>)
 * Markup opts in with attributes:
 *   data-reveal              section rise (only when it starts below the fold)
 *   data-reveal-heading      masked heading rise
 *   data-stagger[="0.11"]    stagger direct children; data-stagger-mode="grow" scales bars from their midline
 *   data-wipe                left-to-right wipe (charts)
 * Everything is skipped under prefers-reduced-motion, and focusing hidden content finishes it at once.
 */
(function () {
  var EASE_CALM = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
  var EASE_OUT = 'cubic-bezier(0.165, 0.84, 0.44, 1)'; // GSAP power3.out
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;

  function reduced() { return !!(mq && mq.matches); }
  function able() { return !reduced() && !!(Element.prototype.animate); }
  function once(el) { if (!seen) return true; if (seen.has(el)) return false; seen.add(el); return true; }
  function belowFold(el) { return el.getBoundingClientRect().top > window.innerHeight; }
  function pageScrolls() { return document.documentElement.scrollHeight > window.innerHeight + 4; }

  function whenVisible(el, opts, cb) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); cb(); return; }
      }
    }, opts);
    io.observe(el);
  }
  function finishOnFocus(el, anims) {
    el.addEventListener('focusin', function () {
      for (var i = 0; i < anims.length; i++) { try { anims[i].finish(); } catch (e) {} }
    }, { once: true });
  }

  /* Masked rise without touching the DOM: the element slides up while its bottom
     clip shrinks by the same amount, so the visible edge stays on the line. */
  function line(el, delay) {
    return el.animate([
      { transform: 'translateY(110%)', clipPath: 'inset(0 -4% 110% -4%)' },
      { transform: 'translateY(0)', clipPath: 'inset(-20% -4% -20% -4%)' }
    ], { duration: 1200, delay: delay || 0, easing: EASE_OUT, fill: 'backwards' });
  }
  function rise(el, y, duration, delay) {
    return el.animate([
      { opacity: 0, transform: 'translateY(' + y + 'px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: duration, delay: delay || 0, easing: EASE_CALM, fill: 'backwards' });
  }
  function grow(el, delay) {
    return el.animate([
      { opacity: 0, transform: 'scaleY(0)', transformOrigin: '50% 50%' },
      { opacity: 1, transform: 'scaleY(1)', transformOrigin: '50% 50%' }
    ], { duration: 600, delay: delay || 0, easing: EASE_CALM, fill: 'backwards' });
  }
  function wipe(el, delay) {
    return el.animate([
      { clipPath: 'inset(-10% 100% -10% 0)' },
      { clipPath: 'inset(-10% 0% -10% 0)' }
    ], { duration: 1200, delay: delay || 0, easing: EASE_OUT, fill: 'backwards' });
  }
  function staggerAnims(el) {
    var step = parseFloat(el.getAttribute('data-stagger')) || 0.11;
    var mode = el.getAttribute('data-stagger-mode');
    var kids = el.children, out = [];
    for (var i = 0; i < kids.length; i++) {
      var d = Math.min(i, 14) * step * 1000;
      out.push(mode === 'grow' ? grow(kids[i], d) : rise(kids[i], 16, 600, d));
    }
    return out;
  }
  function held(anims) { for (var i = 0; i < anims.length; i++) anims[i].pause(); return anims; }
  function play(anims) { for (var i = 0; i < anims.length; i++) anims[i].play(); }

  function mount(root) {
    if (!able()) return;
    root = root || document;
    var scrolls = pageScrolls();

    each(root, '[data-reveal]', function (el) {
      if (!scrolls || !belowFold(el)) return;
      var a = held([rise(el, 28, 1000)]);
      finishOnFocus(el, a);
      whenVisible(el, { rootMargin: '0px 0px -8% 0px' }, function () { play(a); });
    });
    each(root, '[data-reveal-heading]', function (el) {
      var a = held([line(el)]);
      finishOnFocus(el, a);
      whenVisible(el, { threshold: 0.25 }, function () { play(a); });
    });
    each(root, '[data-stagger]', function (el) {
      var a = held(staggerAnims(el));
      finishOnFocus(el, a);
      whenVisible(el, { threshold: 0.15 }, function () { play(a); });
    });
    each(root, '[data-wipe]', function (el) {
      var a = held([wipe(el)]);
      whenVisible(el, { threshold: 0.25 }, function () { play(a); });
    });
  }
  function each(root, sel, fn) {
    var list = root.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) if (once(list[i])) fn(list[i]);
  }

  /* Content swapped in place (a view switch): a short calm rise, then wire up anything new. */
  function swap(el) {
    if (!el) return;
    if (able()) rise(el, 12, 500);
    mount(el);
  }
  /* Redraw one chart series after the reader picks another. */
  function redraw(el) { if (el && able()) wipe(el); }

  /* Theme switch as a cross-fade where the browser supports view transitions. */
  function theme(apply) {
    if (!reduced() && document.startViewTransition) document.startViewTransition(apply);
    else apply();
  }

  /* Design-system demo: replay every sample inside a container. */
  function demo(container) {
    if (!container || !able()) return;
    var q = function (s) { return container.querySelectorAll(s); };
    var i;
    var lines = q('[data-demo="line"]');
    for (i = 0; i < lines.length; i++) line(lines[i], i * 140);
    var rises = q('[data-demo="rise"]');
    for (i = 0; i < rises.length; i++) rise(rises[i], 28, 1000);
    var groups = q('[data-demo="stagger"]');
    for (i = 0; i < groups.length; i++) staggerAnims(groups[i]);
    var wipes = q('[data-demo="wipe"]');
    for (i = 0; i < wipes.length; i++) wipe(wipes[i]);
  }

  window.WighMotion = { mount: mount, swap: swap, redraw: redraw, theme: theme, demo: demo, reduced: reduced };
  /* Pages call mount() from componentDidMount; this catches a page that rendered before the script arrived. */
  if (document.readyState === 'complete') setTimeout(function () { mount(document); }, 0);
  else window.addEventListener('load', function () { mount(document); }, { once: true });
})();
