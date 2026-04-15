const fs = require('fs');
const path = require('path');

const replacements = [
  { from: '@vt/types', to: '@/sync/types' },
  { from: '@/store/selectionStore', to: '@/store' },
  { from: 'useSelectionStore', to: 'useGameStore' },
  { from: 'useAppSelector', to: 'useGameStore' },
  { from: 'useAppDispatch', to: 'useGameStore' },
  { from: '@/store/slices/mapSlice', to: '@/store' },
  { from: '@/store/slices/shipSlice', to: '@/store' },
];

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      for (const { from, to } of replacements) {
        if (content.includes(from)) {
          content = content.replaceAll(from, to);
          modified = true;
        }
      }
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Modified:', fullPath);
      }
    }
  }
}

walkDir(path.join(__dirname, 'packages/client/src'));
console.log('Done!');