const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', 'utf8');

// Remove the duplicate handleChange function at the end
const fixed = content.replace(
  '\n\nfunction handleChange(key: string, value: any) {\n  // This is a placeholder - the actual handler is in the component\n}\n',
  ''
);

fs.writeFileSync('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', content);
console.log('Removed duplicate handleChange function');