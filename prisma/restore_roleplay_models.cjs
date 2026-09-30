const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const roleplayModels = `
model RoleplaySession {
  id                      String    @id @default(cuid())
  interpreterId           Int?      @map("interpreter_id")
  recruitmentCandidateId  Int?      @map("recruitment_candidate_id")
  baseAudioUrl            String    @map("base_audio_url")
  recordedAudioUrl        String?   @map("recorded_audio_url")
  status                  RoleplayStatus @default(PENDING)
  evaluatorId             String?   @map("evaluator_id")
  qaScoreId               Int?      @unique @map("qa_score_id")
  submittedAt             DateTime? @map("submitted_at")
  evaluatedAt             DateTime? @map("evaluated_at")
  completedAt             DateTime? @map("completed_at")
  currentScenarioIndex    Int       @default(0) @map("current_scenario_index")
  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  interpreter             Interpreter?         @relation(fields: [interpreterId], references: [id], onDelete: SetNull, onUpdate: Restrict)
  recruitmentCandidate    RecruitmentCandidate? @relation(fields: [recruitmentCandidateId], references: [id], onDelete: SetNull, onUpdate: Restrict)
  qaScore                 QAScore?             @relation(fields: [qaScoreId], references: [id], onDelete: SetNull, onUpdate: Restrict)
  access                  RoleplayAccess?
  scenarios               RoleplayScenario[]

  @@index([interpreterId, status], map: "idx_roleplay_interpreter_status")
  @@index([recruitmentCandidateId, status], map: "idx_roleplay_candidate_status")
  @@index([status, createdAt], map: "idx_roleplay_status_created")
  @@index([status, submittedAt], map: "idx_roleplay_status_submitted")
  @@map("roleplay_sessions")
  @@schema("public")
}

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

model RoleplayAccess {
  id        String   @id @default(cuid())
  sessionId String   @map("session_id")
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime @default(now()) @map("created_at")

  session   RoleplaySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId], map: "roleplay_access_session_id_key")
  @@index([tokenHash], map: "idx_roleplay_access_token_hash")
  @@index([expiresAt], map: "idx_roleplay_access_expires")
  @@map("roleplay_access")
  @@schema("public")
}

enum RoleplayStatus {
  PENDING
  EVALUATED

  @@schema("public")
}
`;

const lines = content.split('\n');
let insertIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  const trimmed = lines[i].trim();
  if (trimmed === '}' && lines[i-1]?.trim() === '@@schema("public")') {
    // Found the end of Notification model
    insertIndex = i + 1;
    break;
  }
}

if (insertIndex >= 0) {
  const newLines = [
    ...lines.slice(0, insertIndex),
    '',
    roleplayModels
  ];
  fs.writeFileSync('prisma/schema.prisma', newLines.join('\n'));
  console.log('Added roleplay models');
} else {
  console.log('Could not find insertion point');
}