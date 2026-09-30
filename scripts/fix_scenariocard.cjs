const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/ScenarioCard.tsx', 'utf8');

// Fix line 123: change '}' to ')}' to close the conditional expression
// Fix line 183-184: fix the onChange handler closure and input element
let fixed = content
  // Fix line 123: change '}' to ')}' to close the conditional expression
  .replace(
    '              }\n            </div>',
    '              )}\n            </div>'
  )
  // Fix line 183-185: fix the onChange handler closure and input element
  .replace(
    '              }\n              className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-white focus:border-blue-500 transition-colors file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500"\n            />',
    '              }}\n            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-white focus:border-blue-500 transition-colors file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500"\n            />'
  );

fs.writeFileSync('src/app/admin/roleplays/new/ScenarioCard.tsx', fixed);
console.log('Fixed ScenarioCard syntax errors');