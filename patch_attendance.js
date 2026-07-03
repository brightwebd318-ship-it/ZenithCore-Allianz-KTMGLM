const fs = require('fs');
let file = 'src/views/AttendanceView.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add import
if (!code.includes("import { Html5QrcodeScanner } from 'html5-qrcode'")) {
  code = code.replace(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport { Html5QrcodeScanner } from 'html5-qrcode';"
  );
}

// Replace the QR Scanner Effect
const qrEffectRegex = /\/\/ QR Scanner Canvas Animation[\s\S]*?\}, \[modalMode\]\);/;

const newQrEffect = `// Real QR Scanner logic
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (modalMode === 'qr') {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0 },
        /* verbose= */ false
      );
      
      const onScanSuccess = (decodedText: string, decodedResult: any) => {
        // Stop scanning
        scanner?.clear();
        setQrScanResult(decodedText);
        setQrSuccessMessage("Scanned successfully! Processing...");
        setQrScanning(true);
        
        // Use the handleMarkQr from the button
        setTimeout(() => {
          handleMarkQr(decodedText);
        }, 1000);
      };

      const onScanFailure = (error: any) => {
        // handle scan failure, usually better to ignore and keep scanning
      };

      scanner.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [modalMode]);`;

code = code.replace(qrEffectRegex, newQrEffect);

// Update handleMarkQr to take scannedText
const handleMarkQrRegex = /const handleMarkQr = async \(\) => \{/;
code = code.replace(handleMarkQrRegex, `const handleMarkQr = async (scannedText?: string) => {`);

// Replace the Canvas view with div#qr-reader
const canvasRegex = /\{\/\* Canvas Viewfinder \*\/\}[\s\S]*?<\/canvas>\s*<\/div>/;
code = code.replace(canvasRegex, `
                  {/* Real QR Viewfinder */}
                  <div className="relative border border-slate-350 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-950 w-full max-w-sm">
                    <div id="qr-reader" className="w-full"></div>
                  </div>
`);

// Remove "Simulate Valid QR Scan" button since we have a real scanner now
const simulateBtnRegex = /<button\s*onClick=\{handleMarkQr\}[\s\S]*?Simulate Valid QR Scan[\s\S]*?<\/button>/;
code = code.replace(simulateBtnRegex, '');

// Save changes
fs.writeFileSync(file, code);
console.log('AttendanceView patched for real QR scanner.');
