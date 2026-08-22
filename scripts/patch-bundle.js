// Post-process pet-bundle.js to make Cubism 2 code conditional.
// pixi-live2d-display checks for Cubism 2 runtime at module level and throws.
// We only use Cubism 4, so we make the Cubism 2 code conditional.

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'src', 'renderer', 'pet', 'pet-bundle.js');
let code = fs.readFileSync(bundlePath, 'utf8');

// Step 1: Change the Cubism 2 guard from throw-if-not-found to conditional block
const throwPattern = 'if (!window.Live2D) {';
const throwIdx = code.indexOf(throwPattern);
if (throwIdx === -1) {
  console.log('Cubism 2 check not found in bundle, already patched?');
  process.exit(0);
}

// Find the closing } of the throw block
const throwBlockStart = throwIdx + throwPattern.length;
const throwCloseIdx = findMatchingBrace(code, throwIdx + throwPattern.indexOf('{'));
const before = code.slice(0, throwIdx);
const after = code.slice(throwCloseIdx + 1);

// Replace "if (!window.Live2D) { throw ... }" with "if (window.Live2D) {"
code = before + 'if (window.Live2D) {' + after;

// Step 2: Add closing } before Cubism 4 check
const cubism4Pattern = 'if (!window.Live2DCubismCore) {';
const c4Idx = code.indexOf(cubism4Pattern);
if (c4Idx === -1) {
  console.error('Cubism 4 check not found!');
  process.exit(1);
}

// Go backwards from Cubism 4 check to find the });
const beforeC4 = code.slice(0, c4Idx);
const lastFactoryClose = beforeC4.lastIndexOf('  });');
if (lastFactoryClose === -1) {
  console.error('Factory closing not found!');
  process.exit(1);
}

const endOfLine = code.indexOf('\n', lastFactoryClose);
code = code.slice(0, endOfLine) + '\n  }\n' + code.slice(endOfLine + 1);

fs.writeFileSync(bundlePath, code);
console.log('Bundle patched: Cubism 2 code made conditional.');

function findMatchingBrace(str, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  while (i < str.length && depth > 0) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') depth--;
    i++;
  }
  return i - 1;
}
