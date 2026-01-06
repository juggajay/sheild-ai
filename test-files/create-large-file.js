const fs = require('fs');
const buffer = Buffer.alloc(15 * 1024 * 1024, 0);
fs.writeFileSync('C:/Users/jayso/Sheild-AI/test-files/large_test_file.pdf', buffer);
console.log('15MB test file created');
