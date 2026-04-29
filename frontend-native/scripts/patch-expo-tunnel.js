const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'start',
  'server',
  'AsyncNgrok.js'
);

if (!fs.existsSync(targetFile)) {
  console.log('[patch-expo-tunnel] AsyncNgrok.js no existe todavia. Se omite el parche.');
  process.exit(0);
}

let contents = fs.readFileSync(targetFile, 'utf8');
let changed = false;

const originalAdbBlock = `        // NOTE(EvanBacon): If the user doesn't have ADB installed,
        // then skip attempting to reverse the port.
        if ((0, _adbReverse.hasAdbReverseAsync)()) {
            // Ensure ADB reverse is running.
            if (!await (0, _adbReverse.startAdbReverseAsync)([
                this.port
            ])) {
                // TODO: Better error message.
                throw new _errors.CommandError('NGROK_ADB', \`Cannot start tunnel URL because \\\`adb reverse\\\` failed for the connected Android device(s).\`);
            }
        }`;

const patchedAdbBlock = `        // MercadoLocal patch:
        // Expo Go por QR no necesita adb reverse para funcionar.
        // Algunos emuladores o consolas ADB locales responden mal y tumban
        // el tunnel aunque el QR para celular si podria abrir sin problema.
        // Por eso, en tunnel omitimos este paso.`;

if (contents.includes(originalAdbBlock)) {
  contents = contents.replace(originalAdbBlock, patchedAdbBlock);
  changed = true;
}

if (contents.includes('error.body.msg,')) {
  contents = contents.replace(
    '                        error.body.msg,',
    "                        ((error == null ? void 0 : error.body) == null ? void 0 : error.body.msg) ?? error.message,"
  );
  changed = true;
}

if (contents.includes('(_error_body_details = error.body.details)')) {
  contents = contents.replace(
    '(_error_body_details = error.body.details)',
    '(_error_body_details = ((error == null ? void 0 : error.body) == null ? void 0 : error.body.details))'
  );
  changed = true;
}

if (contents.includes('error.body.error_code === 103')) {
  contents = contents.replace(
    'error.body.error_code === 103',
    '((error == null ? void 0 : error.body) == null ? void 0 : error.body.error_code) === 103'
  );
  changed = true;
}

if (!changed) {
  console.log('[patch-expo-tunnel] No hubo cambios nuevos por aplicar.');
  process.exit(0);
}

fs.writeFileSync(targetFile, contents, 'utf8');
console.log('[patch-expo-tunnel] Parche aplicado a AsyncNgrok.js');
