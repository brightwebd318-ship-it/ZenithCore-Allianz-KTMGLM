const fs = require('fs');
let file = 'src/views/InventoryView.tsx';
let code = fs.readFileSync(file, 'utf8');

// Fix double accept string
code = code.replace(/accept=".pdf,.jpeg,.jpg"\s*accept=".pdf,.jpeg,.jpg"/g, 'accept=".pdf,.jpeg,.jpg"');

// Fix line 586
code = code.replace(
  /<input\s+type="file"\s+onChange=\{\(e\) => \{/g,
  '<input\n                  type="file"\n                  accept=".pdf,.jpeg,.jpg"\n                  onChange={(e) => {'
);

fs.writeFileSync(file, code);

file = 'src/views/PatientsView.tsx';
code = fs.readFileSync(file, 'utf8');
code = code.replace(
  /<input\s+type="file"\s+onChange=\{\(e\) => setSelectedFile\(e\.target\.files\?\.\[0\] \|\| null\)\}\s+className/g,
  '<input\n                          type="file"\n                          accept=".pdf,.jpeg,.jpg"\n                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}\n                          className'
);
fs.writeFileSync(file, code);
console.log('Restricted file inputs');
