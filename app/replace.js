const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes("user?.barrio?.slug || 'palermo'")) {
        content = content.replace(/user\?\.barrio\?\.slug \|\| 'palermo'/g, "user!.barrio!.slug");
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}
replaceInDir('app/(app)');
