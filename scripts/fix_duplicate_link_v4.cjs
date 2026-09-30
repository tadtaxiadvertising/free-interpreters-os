const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

const lines = content.split('\n');
let linkImportCount = 0;
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim() === 'import Link from "next/link";') {
    linkImportCount++;
    if (linkImportCount === 1) {
      newLines.push(line);
    }
  } else {
    newLines.push(line);
  }
}

fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', newLines.join('\n'));
console.log('Fixed duplicate Link import, removed', linkImportCount - 1, 'duplicates');