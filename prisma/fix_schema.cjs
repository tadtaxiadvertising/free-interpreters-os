const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

let fixed = content
  .replace('updatedAt     DateTime  "updatedAt\]', 'updatedAt               DateTime  @updatedAt @map("updated_at")')
  .replace('@@@index', '@@index');

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Fixed schema');