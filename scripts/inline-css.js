import fs from 'fs';

const dashboard = fs.readFileSync('src/dashboard.ts', 'utf8');
const css = fs.readFileSync('src/styles/output.css', 'utf8');

// Escape backslashes for JavaScript template literals
// In template literals, \ needs to be \\ to be preserved
const escapedCSS = css.replace(/\\/g, '\\\\');

// Replace the style block
const updated = dashboard.replace(
  /  <style>[\s\S]*?  <\/style>/,
  '  <style>\n' + escapedCSS + '\n  </style>'
);

fs.writeFileSync('src/dashboard.ts', updated);
console.log('✓ Fixed CSS with properly escaped backslashes');
