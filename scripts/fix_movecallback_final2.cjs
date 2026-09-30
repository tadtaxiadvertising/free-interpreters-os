const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

// Replace the entire moveScenario function
const fixed = content.replace(
  /const moveScenario = useCallback\(\(id: string, direction: 'up' \| 'down'\) => \{\s*setScenarios\(prev => \{\s*const index = prev\.findIndex\(s => s\.id === id\);\s*if \(index === -1\) return prev;\s*if \(direction === 'up' && index === 0\) return prev;\s*if \(direction === 'down' && index === prev\.length - 1\) return prev;\s*const newScenarios = \[\.\.\.prev\];\s*const targetIndex = direction === 'up' \? index - 1 : index \+ 1;\s*\[newScenarios\[index\], newScenarios\[targetIndex\]\] = \[newScenarios\[targetIndex\], newScenarios\[index\]\];\s*return newScenarios;\s*\}\s*\);\s*}\);\s*}, \[\];/s,
`  const moveScenario = useCallback(function(id: string, direction: 'up' | 'down') {
    setScenarios(prev => {
      const index = prev.findIndex(s => s.id === id);
      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;
      
      const newScenarios = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newScenarios[index], newScenarios[targetIndex]] = [newScenarios[targetIndex], newScenarios[index]];
      return newScenarios;
    });
  }, []);`
);

fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', fixed);
console.log('Fixed moveScenario');