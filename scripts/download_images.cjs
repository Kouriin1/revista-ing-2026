const fs = require('fs');
const path = require('path');
const https = require('https');

const dir = path.join(__dirname, 'src', 'assets', 'imagenes');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const images = [
  { name: 'art01.jpg', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art02.jpg', url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art03.jpg', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art04.jpg', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art05.jpg', url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art06.jpg', url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art07.jpg', url: 'https://images.unsplash.com/photo-1586528116311-ad8ed745eb33?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art08.jpg', url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art09.jpg', url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=80' },
  { name: 'art10.jpg', url: 'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&w=1200&q=80' },
  { name: 'portada.jpg', url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1600&q=80' }
];

images.forEach(({ name, url }) => {
  const dest = path.join(dir, name);
  https.get(url, (res) => {
    const stream = fs.createWriteStream(dest);
    res.pipe(stream);
    stream.on('finish', () => console.log(`Descargada: ${name}`));
  }).on('error', (err) => console.error(err));
});
