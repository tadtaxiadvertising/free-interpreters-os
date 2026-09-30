const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

let fixed = content
  .replace(
    "import { Mic2, Loader2, ArrowLeft, User, UserPlus, AlertCircle } from 'lucide-react';",
    "import { Mic2, Loader2, ArrowLeft, User, UserPlus, AlertCircle, Plus, Trash2, GripVertical, Clock, FileText, ChevronUp, ChevronDown } from 'lucide-react';"
  );

fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', fixed);
console.log('Fixed imports');