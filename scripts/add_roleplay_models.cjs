const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const newModels = `
model RoleplayScenario {
  id                String   @id @default(cuid())
  sessionId         String   @map("session_id")
  order             Int
  title             String
  baseAudioUrl      String   @map("base_audio_url")
  durationLimitSec  Int?     @map("duration_limit_sec")
  scriptPrompt      String?  @map("script_prompt")
  expectedKeys      String[] @map("expected_keys")
  createdAt         DateTime @default(now()) @map("created_at")

  session           RoleplaySession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  responses         RoleplayResponse[]

  @@index([sessionId, order])
  @@map("roleplay_scenarios")
  @@schema("public")
}

model RoleplayResponse {
  id               String   @id @default(cuid())
  scenarioId       String   @map("scenario_id")
  recordedAudioUrl String?  @map("recorded_audio_url")
  durationSec      Int?     @map("duration_sec")
  selfScore        Json?
  selfNotes        String?  @map("self_notes")
  submittedAt      DateTime? @map("submitted_at")
  createdAt        DateTime @default(now()) @map("created_at")

  scenario         RoleplayScenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)

  @@map("roleplay_responses")
  @@schema("public")
}

`;

const fixed = content.replace('enum RoleplayStatus {', newModels + 'enum RoleplayStatus {');

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Added RoleplayScenario and RoleplayResponse models');