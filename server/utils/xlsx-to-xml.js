/**
 * Converts the Excel file to XML format for import into the system.
 * Usage: node server/utils/xlsx-to-xml.js
 */
const XLSX = require('xlsx');
const { XMLBuilder } = require('fast-xml-parser');
const path = require('path');
const fs = require('fs');

const XLSX_PATH = path.join(__dirname, '../../listagem de planos - 05.03.2026.xlsx');
const OUTPUT_PATH = path.join(__dirname, '../../data/planos.xml');

// Column mapping: Excel column name -> database column name (lowercase, no special chars)
const COLUMN_MAP = {
  'CODIGO': 'codigo',
  'NOME': 'nome',
  'ENDERECO': 'endereco',
  'BAIRRO': 'bairro',
  'CEP': 'cep',
  'COMPLEMENTO': 'complemento',
  'CIDADE': 'cidade',
  'ESTADO': 'estado',
  'CGC': 'cgc',
  'EMAIL': 'email',
  'FONE': 'fone',
  'FONE2': 'fone2',
  'FONE3': 'fone3',
  'OBS': 'obs',
  'NUMERO': 'numero',
  'VINDI_CODIGO': 'vindi_codigo',
  'SITE_CODIGO': 'site_codigo',
  'PAGAMENTO': 'pagamento',
  'CADASTRO': 'cadastro',
  'DTNASC': 'dtnasc',
  'USERALTERA': 'useraltera',
  'DT_OBRIGA': 'dt_obriga',
  'STATUSPAG': 'statuspag',
  'CODVEND': 'codvend',
  'VENDEDOR': 'vendedor',
  'BRD_DATANDC': 'brd_datandc',
  'BRD_QUALNDC': 'brd_qualndc',
  'BRD_FUNCNDC': 'brd_funcndc',
  'OBS_JOIANDC': 'obs_joiandc',
  'BRD_DATA': 'brd_data',
  'BRD_QUAL': 'brd_qual',
  'BRD_FUNC': 'brd_func',
  'BLOCO': 'bloco',
  'ENDERESID': 'enderesid',
  'DTNASCRESID': 'dtnascresid',
  'BAIRRESID': 'bairresid',
  'CEPRESID': 'cepresid',
  'CIDARESID': 'cidaresid',
  'ESTARESID': 'estaresid',
  'FONE_TITULAR': 'fone_titular',
  'CIRCULAR': 'circular',
  'MUDA_END': 'muda_end',
  'CARTA_DEP': 'carta_dep',
  'ECIVIL': 'ecivil',
  'NATURALIDA': 'naturalida',
  'CGCRESID': 'cgcresid',
  'RGRESID': 'rgresid',
  'ESPOSA': 'esposa',
  'RESPONS': 'respons',
  'PAI': 'pai',
  'MAE': 'mae',
  'OBS_COMPL': 'obs_compl',
  'PLANO': 'plano',
  'NOMERESID': 'nomeresid',
  'DT_CANCELA': 'dt_cancela',
  'CODPLANO': 'codplano',
  'CODVINDI': 'codvindi',
  'CODCONTRATO': 'codcontrato',
  'NOMEPLANO': 'nomeplano',
};

function convert() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(XLSX_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON, starting from row 2 (headers)
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Row 0 is title, Row 1 is headers, Row 2+ is data
  const headers = rawData[1];
  const dataRows = rawData.slice(2);

  console.log(`Found ${headers.length} columns and ${dataRows.length} data rows`);

  // Map headers to db column names
  const dbColumns = headers.map(h => {
    const mapped = COLUMN_MAP[String(h).trim()];
    if (!mapped) {
      console.warn(`  Unknown column: "${h}" - using lowercase`);
      return String(h).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }
    return mapped;
  });

  // Build column definitions
  const columns = dbColumns.map(name => ({ name, type: 'text' }));

  // Build rows
  const rows = [];
  for (const rawRow of dataRows) {
    const row = {};
    let hasValue = false;
    for (let i = 0; i < dbColumns.length; i++) {
      let val = rawRow[i];
      if (val === undefined || val === null) val = '';
      // Convert Excel date serial numbers for known date columns
      if (['cadastro', 'dtnasc', 'dt_obriga', 'dt_cancela', 'brd_datandc', 'brd_data', 'dtnascresid'].includes(dbColumns[i])) {
        if (typeof val === 'number' && val > 0) {
          try {
            const date = XLSX.SSF.parse_date_code(val);
            val = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
          } catch (e) {
            // keep as-is
          }
        }
      }
      row[dbColumns[i]] = String(val).trim();
      if (row[dbColumns[i]]) hasValue = true;
    }
    if (hasValue) rows.push(row);
  }

  console.log(`Converted ${rows.length} valid rows`);

  // Build XML
  const xmlObj = {
    database: {
      table: {
        name: 'planos',
        display_name: 'Planos de Saude',
        columns: { column: columns },
        rows: { row: rows }
      }
    }
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    format: true,
    indentBy: '  '
  });

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(xmlObj);

  fs.writeFileSync(OUTPUT_PATH, xml, 'utf-8');
  console.log(`XML written to ${OUTPUT_PATH} (${(Buffer.byteLength(xml) / 1024 / 1024).toFixed(1)}MB)`);
}

convert();
