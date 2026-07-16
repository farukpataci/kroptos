const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace imports
  content = content.replace(/PermissionsGuard/g, 'PermissionGuard');
  content = content.replace(/permissions\.guard/g, 'permission.guard');
  content = content.replace(/Permissions/g, 'RequirePermission');
  content = content.replace(/permissions\.decorator/g, 'require-permission.decorator');
  content = content.replace(/@Permissions\(/g, '@RequirePermission(');

  // Fix relative imports if they are still there
  content = content.replace(/import { PermissionGuard } from '\.\.\/\.\.\/\.\.\/common\/guards\/permission\.guard';/g, "import { PermissionGuard } from '@common/guards/permission.guard';");
  content = content.replace(/import { RequirePermission } from '\.\.\/\.\.\/\.\.\/common\/decorators\/require-permission\.decorator';/g, "import { RequirePermission } from '@common/decorators/require-permission.decorator';");

  fs.writeFileSync(filePath, content);
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      replaceInFile(fullPath);
    }
  }
}

const targets = [
  'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/analytics',
  'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/settings',
  'c:/Users/Administrator/Desktop/kroptos/packages/backend/src/modules/warehouse-settings'
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    processDirectory(target);
    console.log(`Processed ${target}`);
  }
}
console.log('Imports fixed.');
