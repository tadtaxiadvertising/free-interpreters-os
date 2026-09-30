const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

let fixed = content.replace('schemas  = ["auth", "public"]', 'schemas  = ["public"]');

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Reverted to public schema only');