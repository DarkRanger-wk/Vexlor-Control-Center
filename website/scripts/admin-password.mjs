import { argon2idAsync } from '@noble/hashes/argon2.js';
import { randomBytes } from '@noble/hashes/utils.js';

function readHiddenPassword() {
  return new Promise((resolve, reject) => {
    process.stdout.write('Neues Administrator-Passwort (mindestens 12 Zeichen): ');
    const chunks = [];
    if (!process.stdin.isTTY) {
      reject(new Error('Dieser Befehl benötigt ein interaktives Terminal.'));
      return;
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      if (chunk === '\u0003') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        reject(new Error('Abgebrochen.'));
        return;
      }
      if (chunk === '\r' || chunk === '\n') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(chunks.join(''));
        return;
      }
      if (chunk === '\u007f' || chunk === '\b') {
        chunks.pop();
        return;
      }
      chunks.push(chunk);
    };
    process.stdin.on('data', onData);
  });
}

const password = await readHiddenPassword();
if (password.length < 12) {
  console.error('Das Passwort muss mindestens 12 Zeichen lang sein.');
  process.exit(2);
}

const memory = 19456;
const time = 2;
const parallelism = 1;
const salt = randomBytes(16);
const derived = await argon2idAsync(password, salt, {
  m: memory,
  t: time,
  p: parallelism,
  dkLen: 32,
  asyncTick: 10,
});
const base64 = (bytes) => Buffer.from(bytes).toString('base64');
const hash = [
  'argon2id',
  'v=19',
  `m=${memory},t=${time},p=${parallelism}`,
  base64(salt),
  base64(derived),
].join('$');

console.log('ADMIN_PASSWORD_HASH=' + hash);
console.log('Der Klartext des Passworts wurde nicht gespeichert oder ausgegeben.');
