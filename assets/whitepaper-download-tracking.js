/**
 * Whitepaper index — GA4 download click tracking
 * Event: whitepaper_download_click
 */
(function () {
  var cards = document.querySelectorAll('.report-library-grid a.report-card[data-item-name]');
  if (!cards.length) return;

  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      if (typeof window.gtag !== 'function') return;

      window.gtag('event', 'whitepaper_download_click', {
        item_name: card.dataset.itemName,
        price: Number(card.dataset.price),
        transport_type: 'beacon',
      });
    });
  });
})();
