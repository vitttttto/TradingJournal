import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const zip = new AdmZip('./glassmorphism-trading-journal-dashboard.zip');
zip.extractAllTo('.', true);
console.log('Extracted successfully');
