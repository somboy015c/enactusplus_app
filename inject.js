// Runs inside the app on every dashboard page: removes links to the public website and the "Download the app" menu.
(function () {
  var RX = /^\s*(←\s*)?(view\s+(the\s+)?(web)?site|back\s+to\s+(the\s+)?(web)?site)/i;
  function run() {
    try {
      document.querySelectorAll('.dl-menu').forEach(function (d) { d.style.setProperty('display', 'none', 'important'); });
      document.querySelectorAll('a').forEach(function (a) {
        if (RX.test(a.textContent || '')) {
          a.style.setProperty('display', 'none', 'important');
          var p = a.parentElement;
          if (p && p.classList.contains('auth-note')) p.style.setProperty('display', 'none', 'important');
        }
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.addEventListener('load', run);
})();
