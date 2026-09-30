const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', 'utf8');

const lines = content.split('\n');

// Remove the duplicate handleChange at line 112 (0-indexed: 111)
const lines = content.split('\n');
lines.splice(111, 2); // Remove the duplicate const handleChange line and its closing brace

fs.writeFileSync('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', lines.join('\n'));
console.log('Removed duplicate handleChange');