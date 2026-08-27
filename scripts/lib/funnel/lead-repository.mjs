function createLeadRepository({ saveLead, updateLead, findLead, upsertLead } = {}) {
  if (typeof saveLead !== 'function' || typeof updateLead !== 'function') {
    throw new TypeError('LeadRepository requires saveLead and updateLead adapters');
  }
  return Object.freeze({
    saveLead: (lead) => saveLead(lead),
    updateLead: (leadId, patch) => updateLead(leadId, patch),
    findLead: typeof findLead === 'function' ? findLead : async () => null,
    upsertLead: typeof upsertLead === 'function' ? upsertLead : null,
  });
}

export { createLeadRepository };
