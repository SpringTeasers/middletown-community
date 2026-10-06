/* =============================================================
   Middletown, CT Community Site — vanilla JS enhancements
   Progressive enhancement only: every page works with JS off.
   No frameworks, no third-party requests.
   ============================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  /* ---------- 1. Theme toggle (persists to localStorage) ---------- */
  var THEME_KEY = 'mcs-theme';

  function storedTheme() {
    try { return window.localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function rememberTheme(value) {
    try { window.localStorage.setItem(THEME_KEY, value); } catch (e) { /* ignore */ }
  }
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function currentThemeIsDark() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'dark') { return true; }
    if (explicit === 'light') { return false; }
    return systemPrefersDark();
  }

  function syncThemeButtons() {
    var isDark = currentThemeIsDark();
    var buttons = doc.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', isDark ? 'true' : 'false');
      var label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
      buttons[i].setAttribute('aria-label', label);
      buttons[i].setAttribute('title', label);
    }
  }

  function applyStoredTheme() {
    var saved = storedTheme();
    if (saved === 'dark' || saved === 'light') {
      root.setAttribute('data-theme', saved);
    }
    syncThemeButtons();
  }

  applyStoredTheme();

  function onThemeToggleClick() {
    var next = currentThemeIsDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    rememberTheme(next);
    syncThemeButtons();
  }

  var themeButtons = doc.querySelectorAll('.theme-toggle');
  for (var t = 0; t < themeButtons.length; t++) {
    themeButtons[t].addEventListener('click', onThemeToggleClick);
  }

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function () {
      if (!storedTheme()) { syncThemeButtons(); }
    };
    if (mq.addEventListener) { mq.addEventListener('change', onSystemChange); }
    else if (mq.addListener) { mq.addListener(onSystemChange); }
  }

  /* ---------- 2. Mobile navigation sheet ---------- */
  var sheet = doc.getElementById('nav-sheet');
  var openBtn = doc.querySelector('.js-menu-open');
  var closeBtn = doc.querySelector('.js-menu-close');

  function isSheetOpen() {
    return !!sheet && sheet.getAttribute('data-open') === 'true';
  }

  function openSheet() {
    if (!sheet || !openBtn) { return; }
    sheet.setAttribute('data-open', 'true');
    openBtn.setAttribute('aria-expanded', 'true');
    doc.body.classList.add('no-scroll');
    var first = sheet.querySelector('.js-menu-close');
    if (first) { first.focus(); }
  }

  function closeSheet(returnFocus) {
    if (!sheet || !openBtn) { return; }
    sheet.setAttribute('data-open', 'false');
    openBtn.setAttribute('aria-expanded', 'false');
    doc.body.classList.remove('no-scroll');
    if (returnFocus) { openBtn.focus(); }
  }

  if (sheet && openBtn) {
    openBtn.addEventListener('click', function () {
      if (isSheetOpen()) { closeSheet(true); } else { openSheet(); }
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { closeSheet(true); });
    }
    /* Close on internal navigation so the sheet never trails the new page. */
    var sheetLinks = sheet.querySelectorAll('a[href]');
    for (var s = 0; s < sheetLinks.length; s++) {
      sheetLinks[s].addEventListener('click', function () {
        sheet.setAttribute('data-open', 'false');
        openBtn.setAttribute('aria-expanded', 'false');
        doc.body.classList.remove('no-scroll');
      });
    }
    /* Escape closes; Tab is trapped inside the sheet while it is open. */
    doc.addEventListener('keydown', function (event) {
      if (!isSheetOpen()) { return; }
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeSheet(true);
        return;
      }
      if (event.key !== 'Tab') { return; }
      var focusables = sheet.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) { return; }
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    /* Leaving the desktop breakpoint while open would strand the sheet. */
    if (window.matchMedia) {
      var wide = window.matchMedia('(min-width: 64rem)');
      var onWide = function (event) {
        if (event.matches && isSheetOpen()) { closeSheet(false); }
      };
      if (wide.addEventListener) { wide.addEventListener('change', onWide); }
      else if (wide.addListener) { wide.addListener(onWide); }
    }
  }

  /* ---------- 3. Businesses directory filter (enhancement only) ---------- */
  var dirRegion = doc.getElementById('directory');
  if (dirRegion) {
    var rows = Array.prototype.slice.call(dirRegion.querySelectorAll('tbody tr[data-category]'));
    var searchInput = doc.getElementById('biz-search');
    var sortSelect = doc.getElementById('biz-sort');
    var chips = Array.prototype.slice.call(doc.querySelectorAll('.chip[data-filter]'));
    var summary = doc.getElementById('biz-summary');
    var empty = doc.getElementById('biz-empty');
    var table = dirRegion.querySelector('table');
    var clearBtn = doc.getElementById('biz-clear');
    var activeCategory = 'all';

    function normalise(text) {
      return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function rowCategory(row) {
      return row.getAttribute('data-category') || '';
    }
    function rowName(row) {
      return row.getAttribute('data-name') || '';
    }
    function rowPlace(row) {
      return row.getAttribute('data-place') || '';
    }

    function setCategory(category) {
      activeCategory = category;
      for (var c = 0; c < chips.length; c++) {
        var on = chips[c].getAttribute('data-filter') === category;
        chips[c].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }

    function apply() {
      var query = normalise(searchInput ? searchInput.value : '');
      var shown = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var matchesCategory =
          activeCategory === 'all' || rowCategory(row) === activeCategory;
        var haystack = normalise(rowName(row) + ' ' + rowPlace(row) + ' ' + row.textContent);
        var matchesQuery = query === '' || haystack.indexOf(query) !== -1;
        var visible = matchesCategory && matchesQuery;
        row.hidden = !visible;
        if (visible) { shown++; }
      }

      if (table) {
        table.hidden = shown === 0;
      }
      if (empty) {
        empty.hidden = shown !== 0;
      }
      if (summary) {
        summary.textContent = shown + ' of ' + rows.length + ' businesses shown';
      }
    }

    function sortRows() {
      if (!sortSelect || !table) { return; }
      var body = table.querySelector('tbody');
      var mode = sortSelect.value;
      var sorted = rows.slice();
      sorted.sort(function (a, b) {
        if (mode === 'name-desc') {
          return rowName(b).localeCompare(rowName(a));
        }
        if (mode === 'category') {
          var byCategory = rowCategory(a).localeCompare(rowCategory(b));
          if (byCategory !== 0) { return byCategory; }
        }
        return rowName(a).localeCompare(rowName(b));
      });
      for (var i = 0; i < sorted.length; i++) {
        body.appendChild(sorted[i]);
      }
    }

    if (searchInput) { searchInput.addEventListener('input', apply); }
    if (sortSelect) {
      sortSelect.addEventListener('change', function () { sortRows(); apply(); });
    }
    for (var ch = 0; ch < chips.length; ch++) {
      chips[ch].addEventListener('click', function () {
        var value = this.getAttribute('data-filter');
        setCategory(activeCategory === value ? 'all' : value);
        apply();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchInput) { searchInput.value = ''; }
        setCategory('all');
        sortRows();
        apply();
      });
    }
    apply();
  }

  /* ---------- 4. Back to top ---------- */
  var toTop = doc.querySelector('.to-top');
  if (toTop) {
    var onScroll = function () {
      var threshold = window.innerHeight * 2;
      toTop.setAttribute('data-visible', window.pageYOffset > threshold ? 'true' : 'false');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    toTop.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      var skip = doc.querySelector('.skip-link');
      if (skip) { skip.focus({ preventScroll: true }); }
    });
  }

  /* ---------- 5. Contact form: inline, accessible validation ---------- */
  var form = doc.getElementById('contact-form');
  if (form) {
    var summary = doc.getElementById('form-summary');
    var success = doc.getElementById('form-success');

    function fieldWrapper(input) {
      return input.closest('.field');
    }
    function errorNode(input) {
      return doc.getElementById(input.id + '-error');
    }
    function describe(input, message) {
      var wrapper = fieldWrapper(input);
      var node = errorNode(input);
      if (!wrapper || !node) { return; }
      if (message) {
        wrapper.classList.add('invalid');
        node.textContent = message;
        node.hidden = false;
        input.setAttribute('aria-invalid', 'true');
      } else {
        wrapper.classList.remove('invalid');
        node.textContent = '';
        node.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    }
    function validate(input) {
      var value = (input.value || '').trim();
      if (input.hasAttribute('required') && value === '') {
        describe(input, 'This field is required.');
        return false;
      }
      if (input.type === 'email' && value !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        describe(input, 'Enter an email address in the format name@example.com.');
        return false;
      }
      describe(input, '');
      return true;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var inputs = Array.prototype.slice.call(
        form.querySelectorAll('input[type="text"], input[type="email"], select, textarea')
      );
      var invalid = [];
      for (var i = 0; i < inputs.length; i++) {
        if (!validate(inputs[i])) { invalid.push(inputs[i]); }
      }
      if (invalid.length) {
        if (summary) {
          summary.hidden = false;
          summary.textContent = invalid.length === 1
            ? 'There is 1 problem with this form. Check the field marked below.'
            : 'There are ' + invalid.length + ' problems with this form. Check the fields marked below.';
          summary.focus();
        }
        invalid[0].focus();
        return;
      }
      if (summary) { summary.hidden = true; }
      /* Static teaser build: no backend is wired up, so we confirm receipt
         explicitly rather than pretending the message was delivered. */
      if (success) {
        success.hidden = false;
        success.focus();
      }
      form.reset();
    });

    var watched = form.querySelectorAll('input[type="text"], input[type="email"], select, textarea');
    for (var w = 0; w < watched.length; w++) {
      watched[w].addEventListener('blur', function () { validate(this); });
    }
  }

  /* ---------- 6. Copy-link helper on anchor chips (nice-to-have) ---------- */
  /* No-op: anchor chips are ordinary in-page links so they work without JS. */
})();
