const fs = require('fs');
const path = require('path');

const files = fs.readFileSync('files_to_fix.txt', 'utf8').split('\n').filter(Boolean);

for (const file of files) {
  try {
    if (!fs.existsSync(file)) continue;
    const stats = fs.statSync(file);
    if (!stats.isFile()) continue;

    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (content.includes('$29/mo recurring')) {
      content = content.replace(/$29\/mo recurring/g, '$49 one-time');
      changed = true;
    }
    if (content.includes('$29/mo')) {
      content = content.replace(/$29\/mo/g, '$49 one-time');
      changed = true;
    }
    if (content.includes('$29')) {
      content = content.replace(/$29/g, '$49');
      changed = true;
    }
    if (content.includes('29')) {
      // More cautious replacement for bare '29' to avoid corrupting timestamps or other numbers
      // Only replace if it looks like a price or a label in specific contexts
      content = content.replace(/"price": "29"/g, '"price": "49"');
      content = content.replace(/'price': '29'/g, "'price': '49'");
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Fixed: ' + file);
    }
  } catch (err) {
    console.error('Error fixing ' + file + ': ' + err.message);
  }
}
