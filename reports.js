'use strict';
async function loadDailyReport() {
  try {
    const response = await fetch('data/daily-crypto-report.html', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Report unavailable');
    // Only the repository-controlled report fragment is loaded. Never insert API strings as HTML.
    const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
    const report = documentFragment.querySelector('[data-report-date]');
    if (!report || !report.querySelector('section')) throw new Error('Invalid report');
    if (report.dataset.reportKind !== 'published') return;
    document.querySelector('#reports-empty').hidden = true;
    document.querySelector('#today').hidden = false;
    document.querySelector('#daily-report').replaceChildren(document.importNode(report, true));
    document.querySelector('#report-date').textContent = report.dataset.reportDate;
    document.querySelector('#report-captured').textContent = report.dataset.reportCaptured || '';
    document.querySelector('#report-kind').textContent = 'Published briefing';
  } catch {
    document.querySelector('#report-status').textContent = 'Reports are temporarily unavailable. Please check back later.';
  }
}
loadDailyReport();
