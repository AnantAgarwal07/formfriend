const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const intelligenceService = require('./src/intelligence/intelligence.service');

const DEMO_DIR = path.join(__dirname, 'formfill-main', 'demo-sites');

function extractLabel(element, document) {
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent.trim();
  }
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true);
    const inputs = clone.querySelectorAll('input, select, textarea');
    inputs.forEach(i => i.remove());
    return clone.textContent.trim();
  }
  if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent.trim();
  }
  if (element.placeholder) return element.placeholder;
  if (element.name) return element.name.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
  return '';
}

function extractGroupLabel(element, document) {
  const fieldset = element.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) return legend.textContent.trim();
  }
  const parentDiv = element.closest('div');
  if (parentDiv) {
    const header = parentDiv.querySelector('h1, h2, h3, h4, h5, h6, strong, label:not([for])');
    if (header && !header.contains(element)) return header.textContent.trim();
  }
  if (element.name) return element.name.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
  return '';
}

async function runTests() {
  console.log('====== FORM_FRIEND BATCH HTML TEST ======');
  const allFiles = [];

  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith('.html')) {
        allFiles.push(fullPath);
      }
    }
  }

  walk(DEMO_DIR);

  let totalFields = 0;
  let resolvedFields = 0;
  
  for (const file of allFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const elements = document.querySelectorAll('input, select, textarea');
    let fileFields = 0;
    let fileResolved = 0;
    
    console.log(`\n\n=== Scanning: ${path.basename(file)} ===`);
    
    const radioGroups = {};

    for (const element of elements) {
      const type = (element.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'file', 'image', 'reset'].includes(type)) continue;
      
      if (type === 'radio') {
        const groupName = element.name || 'unnamed-radio';
        if (!radioGroups[groupName]) {
          radioGroups[groupName] = element;
        }
        continue;
      }
      
      const label = extractLabel(element, document);
      if (!label) continue;
      if (label.toLowerCase().includes('agree') || label.toLowerCase().includes('terms')) continue; // Skip consent
      
      fileFields++;
      totalFields++;
      
      const fieldData = {
        label,
        name: element.name || '',
        id: element.id || '',
        type,
        placeholder: element.placeholder || ''
      };
      
      try {
        const result = await intelligenceService.resolveField(fieldData, 'test-fingerprint');
        if (result.status === 'resolved') {
          console.log(`  ["?] MAPPED: "${label}" -> ${result.profileField} (${Math.round(result.confidence*100)}% via ${result.method})`);
          fileResolved++;
          resolvedFields++;
        } else {
          console.log(`  ["?] AMBIGUOUS: "${label}" -> fallback required`);
        }
      } catch (err) {
        console.log(`  ["~] ERROR on "${label}": ${err.message}`);
      }
    }
    
    // Check Radios
    for (const [name, firstEl] of Object.entries(radioGroups)) {
      const label = extractGroupLabel(firstEl, document) || name;
      fileFields++;
      totalFields++;
      
      try {
        const result = await intelligenceService.resolveField({ label, name, type: 'radio' }, 'test-fingerprint');
        if (result.status === 'resolved') {
          console.log(`  ["?] MAPPED (RADIO): "${label}" -> ${result.profileField}`);
          fileResolved++;
          resolvedFields++;
        } else {
          console.log(`  ["?] AMBIGUOUS (RADIO): "${label}"`);
        }
      } catch (e) {}
    }
    
    console.log(`--- Result for ${path.basename(file)}: ${fileResolved}/${fileFields} fields resolved ---`);
  }
  
  console.log(`\n=========================================`);
  console.log(`OVERALL RESULTS: ${resolvedFields} out of ${totalFields} fields resolved automatically by backend.`);
  console.log(`=========================================`);
}

runTests();
