const fs = require('fs');
const content = fs.readFileSync('prisma/schema.prisma', 'utf8');

let fixed = content.replace(
  'updatedAt               DateTime  @updatedAt @map("updated_at")\n\n  interpreter',
  'completedAt             DateTime? @map("completed_at")\n  currentScenarioIndex    Int       @default(0) @map("current_scenario_index")\n  updatedAt               DateTime  @updatedAt @map("updated_at")\n\n  interpreter'
);

fs.writeFileSync('prisma/schema.prisma', fixed);
console.log('Added missing fields to RoleplaySession');