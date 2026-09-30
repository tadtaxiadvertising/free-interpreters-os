const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

// Remove duplicate 'const participants =' declaration
const lines = content.split('\n');
let participantsCount = 0;
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('const participants = participantType ===') && line.includes('interpreters : candidates')) {
    participantsCount++;
    if (participantsCount === 1) {
      newLines.push(line);
    }
  } else {
    newLines.push(line);
  }
}

fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', newLines.join('\n'));
console.log('Fixed duplicate participants declaration, kept first, removed', participantsCount - 1);