/**
 * Opens a print preview popup window and attaches event handlers from the parent
 * script so the popup HTML requires zero inline <script> or onclick attributes (CSP-safe).
 *
 * @param {string} html
 * @param {string} blockedMessage
 */
export function openPrintPreview(html, blockedMessage = 'Please allow popups to print.') {
  const w = window.open('', '_blank', 'width=1300,height=860');
  if (!w) {
    alert(blockedMessage);
    return;
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  const doc = w.document;
  doc.replaceChild(doc.importNode(parsed.documentElement, true), doc.documentElement);

  const printBtn = doc.getElementById('tps-print-btn');
  const closeBtn = doc.getElementById('tps-close-btn');
  if (printBtn) printBtn.addEventListener('click', () => w.print());
  if (closeBtn) closeBtn.addEventListener('click', () => w.close());

  const triggerPrint = () => {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (_) {}
    }, 300);
  };

  const imgs = doc.images;
  if (!imgs || imgs.length === 0) {
    triggerPrint();
  } else {
    let loaded = 0;
    const onImgDone = () => {
      loaded += 1;
      if (loaded >= imgs.length) triggerPrint();
    };
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].complete) {
        onImgDone();
      } else {
        imgs[i].addEventListener('load', onImgDone);
        imgs[i].addEventListener('error', onImgDone);
      }
    }
  }

  try {
    w.opener = null;
  } catch (_) {}
}
