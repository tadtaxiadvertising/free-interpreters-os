with open("prisma/schema.prisma", "r") as f:
    content = f.read()

content = content.replace("currentSCenarioIndex", "currentSCenarioIndex")
content = content.replace("updatedAt     DateTime \\\"updatedAt\\", "updatedAt     DateTime  @updatedAt @map(\"updated_at\")")
content = content.replace("@@Aindex", "@@index")

with open("prisma/schema.prisma", "w") as f:
    f.write(content)
print("Fixed")