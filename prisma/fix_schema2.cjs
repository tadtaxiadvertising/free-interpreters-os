const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

let fixed = content
  .replace('@default(PDENDING)', '@default(PENDING)')
  .replace('qsCoreId      Int?    @unique @map("qa_score_id")', 'qaScoreId     Int?    @unique @map("qa_score_id")');

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Fixed status default and qaScoreId field name');