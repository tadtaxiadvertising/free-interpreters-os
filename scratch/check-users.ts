import 'dotenv/config';
import { getPrisma } from '../src/lib/prisma';

async function main() {
  const prisma = getPrisma();
  const profiles = await prisma.userProfile.findMany({
    include: {
      interpreter: {
        select: {
          name: true,
          emailCorporativo: true
        }
      }
    }
  });

  console.log("=== USER PROFILES ===");
  console.log(JSON.stringify(profiles, null, 2));
}

main().catch(console.error);
