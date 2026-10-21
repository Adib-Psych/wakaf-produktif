// Canonical submitted content shared by worker/staff ACKs and existing queues.
// Object key order is irrelevant; arrays retain order. No storage or transport.
function workerReportContent(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(workerReportContent).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + workerReportContent(value[key])).join(',') + '}';
}
