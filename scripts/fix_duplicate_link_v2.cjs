const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

// Remove duplicate Link import - keep only the first one
const lines = content.split('\n');
let linkImportCount = 0;
const newLines = lines.filter((line, index) => {
  if (line.trim() === 'import Link from "next/link";') {
    linkImportCount++;
    // Keep only the first occurrence
    return linkImportCount === 1;
  }
  return true;
});

fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', newLines.join('\n'));
console.log('Fixed duplicate Link import');