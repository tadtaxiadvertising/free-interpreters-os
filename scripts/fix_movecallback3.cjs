const fs = require('fs');
const content = fs.readFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', 'utf8');

// Fix the moveScenario useCallback by rewriting it completely
const oldBlock = `  const moveScenario = useCallback((id: string, direction: 'up' | 'down') => {
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
  }, []);`;

const newBlock = `  const moveScenario = useCallback(
    (id: string, direction: 'up' | 'down') => {
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
    },
    []
  );`;

const fixed = content.replace(oldBlock, newBlock);

fs.writeFileSync('src/app/admin/roleplays/new/NewRoleplayForm.tsx', fixed);
console.log('Fixed moveScenario useCallback');