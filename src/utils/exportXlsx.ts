// Lightweight Excel export utility — no external dependencies
// Uses XML Spreadsheet format that opens in Excel, Google Sheets, WPS Office

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function exportToXlsx(sheetName: string, headers: string[], rows: (string | number)[][], fileName: string) {
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1" ss:Size="11"/>
      <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
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

  // Use base64 data URI for maximum browser compatibility with file naming
  const base64 = btoa(unescape(encodeURIComponent('\uFEFF' + xmlContent)));
  const dataUri = `data:application/vnd.ms-excel;base64,${base64}`;

  const link = document.createElement('a');
  link.href = dataUri;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Clean up after a small delay
  setTimeout(() => {
    document.body.removeChild(link);
  }, 100);
}
