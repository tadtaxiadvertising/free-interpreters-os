const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

let fixed = content
  // Fix status default
  .replace('@default(PDENDING)', '@default(PENDING)')
  // Fix qaScoreId field name
  .replace('qsCoreId      Int?    @unique @map("qa_score_id")', 'qaScoreId     Int?    @unique @map("qa_score_id")')
  // Fix interpreter relation (make optional)
  .replace('interpreter      Interpreter @relation(fields: [interpreterId], references: [id], onDelete: SetNull, onUpdate: NoAction)', 'interpreter      Interpreter? @relation(fields: [interpreterId], references: [id], onDelete: SetNull, onUpdate: Restrict)')
  // Replace all NoAction with Restrict
  .replace(/onDelete: NoAction/g, 'onDelete: Restrict')
  .replace(/onUpdate: NoAction/g, 'onUpdate: Restrict')
  // Fix updatedAt line
  .replace('updatedAt     DateTime  "updatedAt\]', 'updatedAt               DateTime  @updatedAt @map("updated_at")')
  // Fix triple index
  .replace('@@@index', '@@index')
  // Add relationMode
  .replace('schemas  = ["public"]\n}', 'schemas  = ["public"]\n  relationMode = "prisma"\n}');

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Applied all fixes');