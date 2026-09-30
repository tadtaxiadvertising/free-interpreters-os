const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'schemas  = ["public"]' && lines[i+1].trim() === '}') {
    lines.splice(i+1, 0, '  relationMode = "prisma"');
    break;
  }
}
fs.writeFileSync('prisma/schema.prisma', lines.join('\n'));
console.log('Fixed');