// Shell-only bilingual (Simplified Chinese / English) runtime for AI Resource
// Hub. Translations are SCOPED to the page chrome (header, top tab bar, mobile
// drawer); the content views (tool cards, tables, summaries) are left untouched.
// Default Simplified Chinese; choice stored in localStorage and switched from
// the avatar menu.
(function () {
  var STORAGE_KEY = 'ai_resource_hub_lang';

  var DICT = {
    '语言 / Language': 'Language',
    'AI 工具集、API 控制台与 Agent 生态地图等的统一入口':
      'A unified entry to AI tools, API consoles and the Agent ecosystem map',
    '切换外观主题': 'Toggle theme',
    '深色模式': 'Dark mode',
    '浅色模式': 'Light mode',
    '未登录': 'Not signed in',
    'Google 登录': 'Sign in with Google',
    '打开用户菜单': 'Open user menu',
    '退出登录': 'Sign out',
    '打开导航与设置菜单': 'Open navigation and settings menu',
    '快捷设置与导航': 'Quick settings and navigation',
    '关闭菜单': 'Close menu',
    '功能导航': 'Navigation',
    '移动端分类导航': 'Mobile category navigation',
    '工具集': 'Tools',
    '控制台': 'Console',
    '模型价格': 'Model pricing',
    '生态图': 'Ecosystem',
    '科研自动化': 'Research automation',
    '支出': 'Expenses',
    '连通性': 'Connectivity',
    '资源管理': 'Resources',
    '外观主题': 'Theme',
    '账户状态': 'Account',
    '资源分类': 'Resource categories',
  };

  var ROOTS = '.site-header, .primary-bar, .mobile-drawer-panel';
  var origText = new WeakMap();
  var origAttr = new WeakMap();

  function normalize(lang) {
    return lang === 'en' ? 'en' : 'zh';
  }
  function getLang() {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY) || 'zh');
    } catch (e) {
      return 'zh';
    }
  }
  function isEn() {
    return getLang() === 'en';
  }
  function pad(original, replacement) {
    var lead = (original.match(/^\s*/) || [''])[0];
    var trail = (original.match(/\s*$/) || [''])[0];
    return lead + replacement + trail;
  }
  function processText(node, en) {
    var parent = node.parentNode;
    if (parent) {
      var tag = parent.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
    }
    if (origText.has(node)) {
      var original = origText.get(node);
      if (en) {
        var key = original.trim();
        if (Object.prototype.hasOwnProperty.call(DICT, key)) {
          var translated = pad(original, DICT[key]);
          if (node.nodeValue !== translated) node.nodeValue = translated;
        }
      } else {
        if (node.nodeValue !== original) node.nodeValue = original;
        origText.delete(node);
      }
      return;
    }
    if (!en) return;
    var current = node.nodeValue;
    var k = current ? current.trim() : '';
    if (!k || !Object.prototype.hasOwnProperty.call(DICT, k)) return;
    origText.set(node, current);
    node.nodeValue = pad(current, DICT[k]);
  }
  function processAttr(el, en) {
    ['placeholder', 'title', 'aria-label', 'alt'].forEach(function (attr) {
      if (!el.hasAttribute(attr)) return;
      var map = origAttr.get(el);
      if (!map) {
        map = new Map();
        origAttr.set(el, map);
      }
      if (!map.has(attr)) map.set(attr, el.getAttribute(attr) || '');
      var original = map.get(attr) || '';
      var key = original.trim();
      if (en && Object.prototype.hasOwnProperty.call(DICT, key)) el.setAttribute(attr, DICT[key]);
      else el.setAttribute(attr, original);
    });
  }
  function walk(root, en) {
    if (!root) return;
    if (root.nodeType === 3) {
      processText(root, en);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) processText(n, en);
    if (root.nodeType === 1) processAttr(root, en);
    var els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label],[alt]') : [];
    els.forEach(function (el) { processAttr(el, en); });
  }
  function applyAll() {
    if (typeof document === 'undefined' || !document.body) return;
    var en = isEn();
    document.querySelectorAll(ROOTS).forEach(function (root) { walk(root, en); });
  }
  function syncLanguageMenu() {
    var label = document.getElementById('hub-menu-language-label');
    if (label) label.textContent = isEn() ? '简体中文' : 'English';
  }
  function setLang(lang) {
    var next = normalize(lang);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* ignore */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
    applyAll();
    syncLanguageMenu();
    document.dispatchEvent(new CustomEvent('airh:lang-changed', { detail: next }));
  }
  function init() {
    applyAll();
    document.documentElement.lang = isEn() ? 'en' : 'zh-CN';
    syncLanguageMenu();
    var languageButton = document.getElementById('hub-menu-language');
    if (languageButton) languageButton.addEventListener('click', function () { setLang(isEn() ? 'zh' : 'en'); });
    var observer = new MutationObserver(function (mutations) {
      var en = isEn();
      mutations.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(function (node) {
          var parent = node.parentNode;
          if (parent && parent.closest && parent.closest(ROOTS)) walk(node, en);
          else if (node.nodeType === 1 && node.matches && node.matches(ROOTS)) walk(node, en);
        });
        else if (m.type === 'characterData' && m.target.parentNode && m.target.parentNode.closest && m.target.parentNode.closest(ROOTS)) {
          processText(m.target, en);
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.AIRHI18N = { getLang: getLang, setLang: setLang, isEn: isEn };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
