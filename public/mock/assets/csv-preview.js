import * as domView from "../../assets/render.js";
import {tr} from './i18n.js';
const rowLimit = 201, columnLimit = 50, textLimit = 1000000;
function readRows(text, delimiter, limit) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const finishCell = () => {
    row.push(cell);
    cell = '';
  };
  const finishRow = () => {
    finishCell();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[domView.concat(i, 1)] === '"') {
          cell = domView.concat(cell, '"');
          i++;
        } else quoted = false;
      } else cell = domView.concat(cell, c);
    } else if (c === '"' && !cell) quoted = true; else if (c === delimiter) finishCell(); else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[domView.concat(i, 1)] === '\n') i++;
      finishRow();
      if (rows.length >= limit) return rows;
    } else cell = domView.concat(cell, c);
  }
  if (cell || row.length || quoted || text.endsWith('"')) finishRow();
  return rows;
}
export function parseCsv(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const textTruncated = text.length > textLimit;
  text = text.slice(0, textLimit);
  const separator = text.match(/^sep=([,;\t|])\r?\n/i);
  let delimiter = separator?.[1];
  if (separator) text = text.slice(separator[0].length);
  if (!delimiter) {
    let best = 0;
    delimiter = ',';
    for (const candidate of [',', ';', '\t', '|']) {
      const sample = readRows(text, candidate, 10).filter(row => row.some(cell => cell.trim())), width = sample[0]?.length || 0;
      const score = width > 1 ? sample.filter(row => row.length === width).length / Math.max(1, sample.length) * width : 0;
      if (score > best) {
        best = score;
        delimiter = candidate;
      }
    }
  }
  const parsed = readRows(text, delimiter, domView.concat(rowLimit, 1)), rows = parsed.slice(0, rowLimit), width = Math.min(columnLimit, Math.max(0, ...rows.map(row => row.length)));
  return {
    rows: rows.map(row => Array.from({
      length: width
    }, (_, i) => row[i] ?? '')),
    truncated: textTruncated || parsed.length > rowLimit || rows.some(row => row.length > columnLimit)
  };
}
export function csvPreview(text, esc) {
  const {rows, truncated} = parseCsv(text);
  if (!rows.length) return domView.element("p", [{
    "class": "notice"
  }], [tr("this_csv_file_is_empty")], false);
  const [header, ...body] = rows;
  return domView.fragment([domView.element("p", [{
    "class": "csv-preview-caption"
  }], [domView.fragment([tr('csv_rows', {
    count: body.length
  }), " · ", tr('csv_columns', {
    count: header.length
  }), truncated ? tr('csv_limit') : ''])], false), domView.element("div", [{
    "class": "csv-preview-scroll"
  }, {
    "role": "region"
  }, {
    "aria-label": tr("csv_file_contents")
  }, {
    "tabindex": "0"
  }], [domView.fragment([domView.join(header.map((cell, i) => domView.element("th", [{
    "scope": "col"
  }], [cell || domView.text(["", tr("column"), " ", domView.concat(i, 1), ""])], false)), ''), domView.join(body.map((row, i) => domView.fragment([domView.element("tr", [], [domView.element("th", [{
    "scope": "row"
  }], [domView.concat(i, 1)], false)], false), domView.join(row.map(cell => domView.element("td", [], [cell], false)), '')])), '')]), domView.element("table", [{
    "class": "csv-preview-table"
  }], [domView.element("thead", [], [domView.element("tr", [], [domView.element("th", [{
    "scope": "col"
  }, {
    "aria-label": tr("row_number")
  }], ["#"], false)], false)], false), domView.element("tbody", [], [], false)], false)], false)]);
}
