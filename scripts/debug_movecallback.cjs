const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '}, []);' && lines[i-1]?.trim() === '}') {
    console.log('Found at line', i+1);
    console.log('Line:', lines[i]);
    console.log('Prev line:', lines[i-1]);
    console.log('Next line:', lines[i+1]);
    
    console.log('Context lines 65-95:');
    for (let j = 64; j < 95; j++) {
      console.log((j+1) + ': ' + lines[j]);
    }
    break;
  }
}