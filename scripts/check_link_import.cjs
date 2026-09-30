const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

const lines = content.split('\n');
let count = 0;
lines.forEach((line, i) => {
  if (line.trim() === 'import Link from "next/link";') {
    count++;
    console.log('Found at line', i+1);
  }
});
console.log('Total:', count);