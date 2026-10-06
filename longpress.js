// longpress.js — 触屏设备上长按条目弹出操作按钮（支出条目 / 资源管理卡片）
// 给被长按的条目加上 .lp-open；CSS 在 (hover: none) 下据此显示 .expenses-item-actions / .manager-list-actions。
(function () {
  var TARGETS = ".expenses-item-row:not(.editing), .manager-list-item";
  var HOLD_MS = 450, MOVE_PX = 8;
  var timer = null, sx = 0, sy = 0, opened = null;

  function close() { if (opened) { opened.classList.remove("lp-open"); opened = null; } }
  function cancel() { if (timer) { clearTimeout(timer); timer = null; } }

  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse") return;
    var target = e.target.closest && e.target.closest(TARGETS);
    if (opened && !(e.target.closest && e.target.closest(".expenses-item-actions, .manager-list-actions"))) close();
    if (!target || e.target.closest("a, input, textarea, select")) return;
    if (e.target.closest(".expenses-item-actions, .manager-list-actions")) return;
    sx = e.clientX; sy = e.clientY;
    cancel();
    timer = setTimeout(function () {
      timer = null;
      close();
      target.classList.add("lp-open");
      opened = target;
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }
    }, HOLD_MS);
  }, { passive: true });

  document.addEventListener("pointermove", function (e) {
    if (timer && (Math.abs(e.clientX - sx) > MOVE_PX || Math.abs(e.clientY - sy) > MOVE_PX)) cancel();
  }, { passive: true });
  ["pointerup", "pointercancel", "scroll"].forEach(function (t) {
    document.addEventListener(t, cancel, { passive: true, capture: true });
  });

  // 触屏长按会触发系统菜单 / 文字选择，在条目上屏蔽
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest(TARGETS) && window.matchMedia("(hover: none)").matches) e.preventDefault();
  });
  // 点击操作按钮后收起
  document.addEventListener("click", function (e) {
    if (opened && e.target.closest(".expenses-item-actions button, .manager-list-actions button")) setTimeout(close, 0);
  });
})();
