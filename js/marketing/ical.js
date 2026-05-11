/* Marketing — RFC 5545 iCalendar export.
   Generates a VCALENDAR string with one VEVENT per item.
   Lines >75 octets are folded per RFC 5545 §3.1. */
(function (root) {
  'use strict';

  function fold(line) {
    if (line.length <= 75) return line;
    var out = '';
    while (line.length > 75) { out += line.slice(0, 75) + '\r\n '; line = line.slice(75); }
    return out + line;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function fmtDT(d) {
    if (!(d instanceof Date)) d = new Date(d);
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
      + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  /* items: [{ id, date, end?, title, channel, owner, status, notes? }] */
  function build(items) {
    items = Array.isArray(items) ? items : [];
    var stamp = fmtDT(new Date());
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CTI Group//Poseidon Marketing//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:CTI Marketing Calendar',
      'X-WR-TIMEZONE:America/New_York'
    ];
    items.forEach(function (it) {
      var start = it.date ? new Date(it.date) : new Date();
      var end   = it.end  ? new Date(it.end)  : new Date(start.getTime() + 60 * 60 * 1000);
      lines.push('BEGIN:VEVENT');
      lines.push(fold('UID:' + (it.id || (Date.now() + '-' + Math.random().toString(36).slice(2))) + '@poseidon.cti-usa.com'));
      lines.push('DTSTAMP:' + stamp);
      lines.push('DTSTART:' + fmtDT(start));
      lines.push('DTEND:' + fmtDT(end));
      lines.push(fold('SUMMARY:' + esc((it.title || 'Untitled') + (it.channel ? ' [' + it.channel + ']' : ''))));
      var desc = [];
      if (it.owner)   desc.push('Owner: ' + it.owner);
      if (it.status)  desc.push('Status: ' + it.status);
      if (it.notes)   desc.push(it.notes);
      if (desc.length) lines.push(fold('DESCRIPTION:' + esc(desc.join(' \\n '))));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  function downloadAs(filename, items) {
    var blob = new Blob([build(items)], { type: 'text/calendar' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename || 'cti-marketing.ics';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  root.MarketingICal = { build: build, downloadAs: downloadAs };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MarketingICal;
})(typeof window !== 'undefined' ? window : globalThis);
