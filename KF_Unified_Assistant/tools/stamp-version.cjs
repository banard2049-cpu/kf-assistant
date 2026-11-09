const fs = require('node:fs');
const path = require('node:path');
const input = process.argv[2] || 'local';
const version = /^v?\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/.test(input) ? input.replace(/^v/, '') : 'local';
fs.writeFileSync(path.join(__dirname, '../public/app-version.js'), `window.KF_APP_VERSION = ${JSON.stringify(version)};\n`);
