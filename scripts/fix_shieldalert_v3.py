import re

with open('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', 'r') as f:
    content = f.read()

# Fix import
content = content.replace(
    'import { ShieldAlert, CheckCircle2, AlertTriangle, Loader2, Scale } from',
    'import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Scale } from'
)

# Fix usage
content = content.replace('<ShieldAlert className="text-red-400" />', '<ShieldCheck className="text-red-400" />')

with open('src/app/admin/roleplays/[id]/RoleplayEvaluationClient.tsx', 'w') as f:
    f.write(content)

print('Fixed ShieldAlert to ShieldCheck')