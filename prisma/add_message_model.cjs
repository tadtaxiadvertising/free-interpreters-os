const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const messageModel = `
model Message {
  id         String    @id @default(dbgenerated("(gen_random_uuid())::text"))
  senderId   String    @map("sender_id") @db.Uuid
  receiverId String    @map("receiver_id") @db.Uuid
  content    String
  isRead     Boolean?  @default(false) @map("is_read")
  createdAt  DateTime? @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([senderId])
  @@index([receiverId])
  @@index([createdAt])
  @@map("messages")
  @@schema("public")
}
`;

const lines = content.split('\n');
let insertIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  const trimmed = lines[i].trim();
  if (trimmed === '}' && lines[i-1]?.trim() === '@@schema("public")') {
    // Check if this is the end of Notification model
    const nextLines = lines.slice(i+1, i+10).join('\n');
    if (nextLines.includes('model RoleplaySession') || lines[i+1]?.trim() === '') {
      insertIndex = i + 1;
      break;
    }
  }
}

if (insertIndex >= 0) {
  const newLines = [
    ...lines.slice(0, insertIndex),
    '',
    messageModel
  ];
  const newContent = [...lines.slice(0, insertIndex), '', messageModel, ...lines.slice(insertIndex)].join('\n');
  fs.writeFileSync('prisma/schema.prisma', newContent);
  console.log('Added Message model');
} else {
  console.log('Could not find insertion point');
}