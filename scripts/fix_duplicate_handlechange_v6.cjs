const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', 'utf8');

const lines = content.split('\n');

// Remove duplicate handleChange at line 112 (0-indexed: 111)
// The duplicate is at lines 112-113 (0-indexed: 111-112)
if (lines[111].includes('const handleChange = (key: string, value: any)') && 
    lines[112].trim() === '};') {
  lines.splice(111, 2); // Remove 2 lines
  console.log('Removed duplicate handleChange at line 112');
} else {
  console.log('Could not find duplicate at expected location');
  // Search for the second occurrence
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleChange = (key: string, value: any)')) {
      console.log('Found at line', i+1, ':', lines[i]);
    }
  }
}

fs.writeFileSync('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', lines.join('\n'));
console.log('Processed');