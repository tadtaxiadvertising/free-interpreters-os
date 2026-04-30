const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('@clerk/nextjs')) {
        content = content.replace(/import \{ auth \} from ['"]@clerk\/nextjs\/server['"];?/g, "import { auth } from '@/lib/auth';");
        content = content.replace(/import \{ auth, currentUser \} from ['"]@clerk\/nextjs\/server['"];?/g, "import { auth } from '@/lib/auth';");
        content = content.replace(/import \{ useClerk \} from ['"]@clerk\/nextjs['"];?/g, "import { logout } from '@/app/actions/auth';");
        content = content.replace(/import \{ useAuth \} from ['"]@clerk\/nextjs['"];?/g, "");
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}
replaceInDir('./src');
