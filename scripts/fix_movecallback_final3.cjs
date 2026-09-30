const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

// Replace lines 71-83 (the moveScenario function) with a fixed version using function keyword
const lines = content.split('\n');

// Find the start of moveScenario
let startLine = -1;
let endLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const moveScenario = useCallback(')) {
    startLine = i;
  }
  if (startLine !== -1 && lines[i].trim() === '}, []);') {
    endLine = i;
    break;
  }
}

if (startLine !== -1 && endLine !== -1) {
  console.log(`Found moveScenario at lines ${startLine+1}-${endLine+1}`);
  
  // Replace lines[startLine] through lines[endLine] with the fixed version
  const newLines = [
    '  const moveScenario = useCallback(function(id: string, direction: \'up\' | \'down\') {',
    '    setScenarios(prev => {',
    '      const index = prev.findIndex(s => s.id === id);',
    '      if (index === -1) return prev;',
    '      if (direction === \'up\' && index === 0) return prev;',
    '      if (direction === \'down\' && index === prev.length - 1) return prev;',
    '      ',
    '      const newScenarios = [...prev];',
    '      const targetIndex = direction === \'up\' ? index - 1 : index + 1;',
    '      [newScenarios[index], newScenarios[targetIndex]] = [newScenarios[targetIndex], newScenarios[index]];',
    '      return newScenarios;',
    '    });',
    '  }, []);'
  ];
  
  // Replace the lines
  const newContent = [
    ...lines.slice(0, startLine),
    ...newLines,
    ...lines.slice(endLine + 1)
  ].join('\n');
  
  fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', newContent);
  console.log('Fixed moveScenario useCallback');
} else {
  console.log('Could not find moveScenario function');
}