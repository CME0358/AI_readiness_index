function createLeadRepository({ saveLead, updateLead } = {}) {
  if (typeof saveLead !== 'function' || typeof updateLead !== 'function') {
    throw new TypeError('LeadRepository requires saveLead and updateLead adapters');
  }
  return Object.freeze({
    saveLead: (lead) => saveLead(lead),
    updateLead: (leadId, patch) => updateLead(leadId, patch),
  });
}

export { createLeadRepository };
