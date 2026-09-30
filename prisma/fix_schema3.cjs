const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

let fixed = content.replace('schemas  = ["public"]', 'schemas  = ["auth", "public"]');

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Added auth schema');