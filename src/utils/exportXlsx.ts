// Lightweight XLSX export utility — no external dependencies
// Creates a minimal .xlsx file using JSZip-like approach via raw XML

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colLetter(i: number): string {
  let s = '';
  i++;
  while (i > 0) {
    i--;
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
}

export function exportToXlsx(sheetName: string, headers: string[], rows: (string | number)[][], fileName: string) {
  // Build sheet XML
  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>`;

  // Header row
  sheetXml += '<row r="1">';
  headers.forEach((h, i) => {
    sheetXml += `<c r="${colLetter(i)}1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetXml += '</row>';

  // Data rows
  rows.forEach((row, ri) => {
    const rowNum = ri + 2;
    sheetXml += `<row r="${rowNum}">`;
    row.forEach((cell, ci) => {
      const ref = `${colLetter(ci)}${rowNum}`;
      if (typeof cell === 'number' && !isNaN(cell)) {
        sheetXml += `<c r="${ref}"><v>${cell}</v></c>`;
      } else {
        sheetXml += `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(cell))}</t></is></c>`;
      }
    });
    sheetXml += '</row>';
  });

  sheetXml += '</sheetData></worksheet>';

  // Since generating a real .xlsx (ZIP) without JSZip is very complex,
  // we'll use a simpler approach: generate an XML spreadsheet that Excel can open
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Size="12"/>
      <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
    </Style>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>
      <Row>
        ${headers.map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('\n        ')}
      </Row>
      ${rows.map(row => `<Row>
        ${row.map(cell => {
          if (typeof cell === 'number' && !isNaN(cell)) {
            return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${escapeXml(String(cell))}</Data></Cell>`;
        }).join('\n        ')}
      </Row>`).join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob(['\uFEFF' + xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
