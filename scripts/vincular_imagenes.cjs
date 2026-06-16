const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'content', 'articulos');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));

files.forEach((file, index) => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  const num = (index + 1).toString().padStart(2, '0');
  const imgPath = `imagenPrincipal: "../../assets/imagenes/art${num}.jpg"`;
  
  if (content.includes('imagenPrincipal:')) {
    content = content.replace(/imagenPrincipal:.*$/m, imgPath);
  } else {
    content = content.replace('resumen:', `${imgPath}\nresumen:`);
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Actualizado ${file}`);
});

// Portada
const edicionPath = path.join(__dirname, 'src', 'content', 'ediciones', '2026-1.json');
let edicion = JSON.parse(fs.readFileSync(edicionPath, 'utf-8'));
edicion.portada = "../../assets/imagenes/portada.jpg";
fs.writeFileSync(edicionPath, JSON.stringify(edicion, null, 2));
console.log('Actualizada portada');
