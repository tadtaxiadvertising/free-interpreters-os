const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

let fixed = content.replace('schemas  = ["public"]\n}', 'schemas  = ["public"]\n  relationMode = "prisma"\n}');

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Added relationMode = prisma');