const fs = require('fs');
const file = 'src/services/dataService.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix getInvoices
code = code.replace(
  /getInvoices: async \(\): Promise<Invoice\[\]> => \{/g,
  'getInvoices: async (monthFilter?: string): Promise<Invoice[]> => {'
);

// 2. Fix addInvoice signature
code = code.replace(
  /customItems\?: Array<\{ name: string; quantity: number; rate: number \}>\n  \): Promise<Invoice> => \{/g,
  'customItems?: Array<{ name: string; quantity: number; rate: number }>,\n    sessionDescription?: string\n  ): Promise<Invoice> => {'
);

fs.writeFileSync(file, code);
console.log('Patched dataService.ts');
