const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

const lines = content.split('\n');
// Remove line 10 (index 9) which is the duplicate 'import Link from "next/link";'
const newLines = lines.filter((line, index) => {
  return !(index === 9 && line.trim() === 'import Link from "next/link";');
});

fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', newLines.join('\n'));
console.log('Fixed duplicate Link import');