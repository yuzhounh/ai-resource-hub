// Apply the saved theme before parsing the body; storage may be unavailable.
(function () {
    let theme = 'dark';
    try {
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') theme = saved;
    } catch (_) { /* Keep the default when storage is blocked. */ }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
})();
