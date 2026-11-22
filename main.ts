// Tiny stack VM, ISA v1 — runs every /input/<id>/ program and writes its
// exact output bytes and exit code to /output/<id>/. Node 22, no deps.
// Rules (kit ISA.md; the reference vm.mjs is the law): 32-bit wrapping
// ints, a 256-value data stack, a 64-deep call stack, 256 words of memory,
// 1,000,000 steps and 65,536 output bytes at most, ten traps, each with
// its own exit code. A trap keeps the output written before it.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const enc = new TextEncoder();

// Runs one program on its input: { out: Uint8Array, code: number }.
// One step, in the reference order: step limit, pc range, opcode known,
// immediate fits, count the step, stack underflow, stack overflow, then
// the instruction's own traps and effect.
function run(p, inp) {
  const D = new Int32Array(256);
  let sp = 0;
  const C = new Int32Array(64);
  let cp = 0;
  const M = new Int32Array(256);
  const out = new Uint8Array(65536);
  let ol = 0, ip = 0, pc = 0, steps = 0;
  const n = p.length;
  const done = (code) => ({ out: out.slice(0, ol), code });
  for (;;) {
    if (steps === 1e6) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = p[pc];
    let imm = 0, pops = 0, pushes = 0;
    switch (op) {
      case 0x00: break; // HALT
      case 0x01: imm = 1; pushes = 1; break; // PUSH8
      case 0x02: imm = 4; pushes = 1; break; // PUSH32
      case 0x03: pops = 1; break; // POP
      case 0x04: pops = 1; pushes = 2; break; // DUP
      case 0x05: pops = 2; pushes = 2; break; // SWAP
      case 0x06: pops = 2; pushes = 3; break; // OVER
      case 0x07: pops = 3; pushes = 3; break; // ROT
      case 0x17: case 0x1b: pops = 1; pushes = 1; break; // NEG, NOT
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15:
      case 0x16: case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d:
      case 0x1e: case 0x20: case 0x21: case 0x22:
        pops = 2; pushes = 1; break; // binary ops
      case 0x30: imm = 2; break; // JMP
      case 0x31: case 0x32: imm = 2; pops = 1; break; // JZ, JNZ
      case 0x33: imm = 2; break; // CALL
      case 0x34: break; // RET
      case 0x40: pops = 1; pushes = 1; break; // LOAD
      case 0x41: pops = 2; break; // STORE
      case 0x50: case 0x51: case 0x53: pops = 1; break; // PRINT, PUTC, EXIT
      case 0x52: pushes = 1; break; // IN
      default: return done(5); // unknown opcode
    }
    if (pc + imm >= n) return done(9);
    steps++;
    const nx = pc + 1 + imm;
    if (sp < pops) return done(2);
    if (sp - pops + pushes > 256) return done(3);
    pc = nx;
    switch (op) {
      case 0x00: return done(0);
      case 0x01: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 0x02: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 0x03: sp--; break;
      case 0x04: D[sp] = D[sp - 1]; sp++; break;
      case 0x05: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 0x06: D[sp] = D[sp - 2]; sp++; break;
      case 0x07: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 0x17: D[sp - 1] = -D[sp - 1] | 0; break;
      case 0x1b: D[sp - 1] = ~D[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15:
      case 0x16: case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d:
      case 0x1e: case 0x20: case 0x21: case 0x22: {
        const b = D[sp - 1], a = D[sp - 2];
        let r;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b); // low 32 bits, exact
        else if (op === 0x13) { if (!b) return done(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 0x14) { if (!b) return done(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 0x15) { if (!b) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (!b) return done(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0; // LTU
        sp -= 2; D[sp++] = r; break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 0x30) { const v = D[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 0x33:
        if (cp === 64) return done(7);
        C[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return done(8);
        pc = C[--cp];
        break;
      case 0x40: {
        const a = D[sp - 1];
        if (a < 0 || a >= 256) return done(6);
        D[sp - 1] = M[a];
        break;
      }
      case 0x41: {
        const a = D[sp - 1], v = D[sp - 2];
        if (a < 0 || a >= 256) return done(6);
        sp -= 2; M[a] = v;
        break;
      }
      case 0x50: {
        const bs = enc.encode(String(D[sp - 1]));
        if (ol + bs.length > 65536) return done(11);
        sp--; out.set(bs, ol); ol += bs.length;
        break;
      }
      case 0x51:
        if (ol + 1 > 65536) return done(11);
        out[ol++] = D[--sp] & 255;
        break;
      case 0x52:
        D[sp++] = ip < inp.length ? inp[ip++] : -1;
        break;
      case 0x53:
        return done(D[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), r.code + '\n');
}
