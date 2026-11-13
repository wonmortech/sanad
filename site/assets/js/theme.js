// SPDX-FileCopyrightText: 2026 Wonmor and Sanad contributors
// SPDX-License-Identifier: Apache-2.0

/* Runs before first paint: applies a saved theme choice. Without one the page follows the system. */
(function () {
  var d = document.documentElement;
  d.classList.remove('no-js');
  try {
    var t = localStorage.getItem('sanad-theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: follow the system */ }
})();
