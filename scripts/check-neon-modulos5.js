// Buscar la estructura de submenús/anidamiento en el Sidebar actual y en el del zip
const fs = require('fs');

const sidebarPath = '/home/z/my-project/src/components/Sidebar.tsx';
const zipSidebarPath = '/tmp/zip_extract/src/components/Sidebar.tsx';

function analyzeSidebar(path, label) {
  console.log(`\n=== ${label} (${path}) ===`);
  if (!fs.existsSync(path)) {
    console.log('  No encontrado');
    return;
  }
  const content = fs.readFileSync(path, 'utf8');
  
  // Buscar definiciones de menú con submenús (children)
  const menuRegex = /\{[^{]*key:\s*'([^']+)'[^}]*label:\s*'([^']+)'[^}]*?(?:children:\s*\[([^\]]+)\])?[^}]*\}/gs;
  
  // Buscar la estructura principal (típicamente un array MENU_ITEMS o similar)
  const menuVarMatch = content.match(/(?:const|let)\s+(MENU_ITEMS|MENU|menuItems|NAVEGACION)\s*[:=][^;]+/);
  if (menuVarMatch) {
    console.log('Variable de menú encontrada:', menuVarMatch[0].substring(0, 100));
  }
  
  // Buscar secciones/categorías que agrupan módulos
  const sectionRegex = /(?:section|categoria|grupo|header):\s*['"]([^'"]+)['"]/g;
  let m;
  const sections = [];
  while ((m = sectionRegex.exec(content)) !== null) {
    sections.push(m[1]);
  }
  if (sections.length) {
    console.log('Secciones encontradas:', sections);
  }
  
  // Buscar patrones como { key: 'X', children: [...] }
  const childrenRegex = /key:\s*'([^']+)'[^}]*label:\s*'([^']+)'[^}]*children/g;
  const parents = [];
  while ((m = childrenRegex.exec(content)) !== null) {
    parents.push({ key: m[1], label: m[2] });
  }
  if (parents.length) {
    console.log('Módulos PADRE (con children):');
    parents.forEach(p => console.log(`  - ${p.key} (${p.label})`));
  }
  
  // Buscar TODOS los keys
  const allKeys = [...content.matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]);
  console.log('Todos los keys:', allKeys.join(', '));
}

analyzeSidebar(sidebarPath, 'SIDEBAR LOCAL ACTUAL');
analyzeSidebar(zipSidebarPath, 'SIDEBAR DEL ZIP (1 ago)');
