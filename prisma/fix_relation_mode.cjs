const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

let fixed = content.replace(
  'schemas  = ["auth", "public"]',
  'schemas  = ["public"]\n  relationMode = "prisma"'
);

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Set relationMode = prisma');