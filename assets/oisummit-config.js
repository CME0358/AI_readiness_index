/**
 * Permanent Agent Readiness landing page configuration.
 */
(function (w) {
  var defaults = {
    campaign: 'agent_readiness',
    source: 'readiness_site',
    medium: 'website',
  };
  w.OISUMMIT_CONFIG = Object.assign({}, defaults, w.OISUMMIT_CONFIG || {});
})(window);
