/**
 * OISUMMIT runtime config — meeting URL fail-closed override point.
 * Set window.OISUMMIT_CONFIG.meetingUrl = '' before this script to hide meeting CTAs.
 */
(function (w) {
  var defaults = {
    meetingUrl: 'https://www.coaretail.com/readiness/mtgschedule',
    campaign: 'oisummit2026',
    source: 'oisummit',
    medium: 'qr',
  };
  w.OISUMMIT_CONFIG = Object.assign({}, defaults, w.OISUMMIT_CONFIG || {});
})(window);
