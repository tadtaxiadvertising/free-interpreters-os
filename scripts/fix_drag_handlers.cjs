const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

let fixed = content.replace(
  '<div key={scenario.id} className="group">',
  '<div key={scenario.id} className="group" onDragStart={() => setDraggingId(scenario.id)} onDragEnd={() => setDraggingId(null)}>'
);

fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', fixed);
console.log('Added drag event handlers');