const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', 'utf8');

// Fix ShieldAlert to ShieldCheck (valid lucide-react icon)
const fixed = content
  .replace(
    'import { ShieldAlert, CheckCircle2, AlertTriangle, Loader2, Scale } from',
    'import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Scale } from'
  )
  .replace(
    '<ShieldAlert className="text-red-400" />',
    '<ShieldCheck className="text-red-400" />'
  );

fs.writeFileSync('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', content);
console.log('Fixed ShieldAlert to ShieldCheck');