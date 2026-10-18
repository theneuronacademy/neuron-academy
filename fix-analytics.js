const fs = require('fs');
const path = 'C:\\Users\\Lenovo\\Projects\\Neuron-Academy\\app\\faculty\\analytics\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace literal < with < in the specific line
content = content.replace(/Att < 75%/g, 'Att < 75%');
content = content.replace(/Avg < 40%/g, 'Avg < 40%');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed analytics page');