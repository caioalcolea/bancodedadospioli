const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res;
}

export const api = {
  // Stats
  getStats: () => request('/meta/stats').then(r => r.json()),
  getHealth: () => request('/health').then(r => r.json()),

  // Tables
  getTables: () => request('/meta/tables').then(r => r.json()),
  getTableColumns: (table) => request(`/meta/tables/${table}/columns`).then(r => r.json()),
  deleteTable: (table) => request(`/meta/tables/${table}`, { method: 'DELETE' }).then(r => r.json()),

  // Data
  getData: (table, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/data/${table}?${qs}`).then(r => r.json());
  },
  getRecord: (table, id) => request(`/data/${table}/${id}`).then(r => r.json()),
  createRecord: (table, data) => request(`/data/${table}`, {
    method: 'POST', body: JSON.stringify(data)
  }).then(r => r.json()),
  updateRecord: (table, id, data) => request(`/data/${table}/${id}`, {
    method: 'PUT', body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteRecord: (table, id) => request(`/data/${table}/${id}`, {
    method: 'DELETE'
  }).then(r => r.json()),

  // Endpoints
  getEndpoints: () => request('/meta/endpoints').then(r => r.json()),

  // Webhooks
  getWebhookLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/webhook/logs/all?${qs}`).then(r => r.json());
  },

  // XML
  importXml: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE}/xml/import`, { method: 'POST', body: formData }).then(r => r.json());
  },
  importUpdateXml: (file, matchField) => {
    const formData = new FormData();
    formData.append('file', file);
    if (matchField) formData.append('match_field', matchField);
    return fetch(`${BASE}/xml/import-update`, { method: 'POST', body: formData }).then(r => r.json());
  },
  exportXml: (table) => `${BASE}/xml/export/${table}`
};
