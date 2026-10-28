import { authApi } from '../api'

// AMOBILE-227: the signup proof-of-work puzzle (AGORA-407 on the backend).
// The server hands out sha256(salt + secret number) and we find the number
// by trying each one, in the background while the person fills in the form.
//
// Hermes has no crypto.subtle, and a native module would cross the bridge
// once per guess, so this is a small SHA-256 in plain JS. Hermes runs one
// SHA-256 block in about 20us on an M3, and salt + number spans two blocks,
// so the checker avoids redoing work: the salt's whole blocks are hashed
// once, and a first block that only holds the number's leading digits is
// reused until those digits change (every 100 guesses for most numbers).
// That brings an average solve to about a second.

export interface SignupSolution {
  algorithm: string
  challenge: string
  number: number
  salt: string
  signature: string
}

const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const INIT = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

const W = new Int32Array(64)

// Runs one SHA-256 compression over the 16 words in block[off..off+16],
// updating state in place.
function compress(state: Int32Array, block: Int32Array, off: number) {
  for (let i = 0; i < 16; i++) W[i] = block[off + i]
  for (let i = 16; i < 64; i++) {
    const w15 = W[i - 15], w2 = W[i - 2]
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3)
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10)
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0
  }
  let a = state[0], b = state[1], c = state[2], d = state[3]
  let e = state[4], f = state[5], g = state[6], h = state[7]
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
    const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0
    h = g; g = f; f = e; e = (d + t1) | 0
    d = c; c = b; b = a; a = (t1 + t2) | 0
  }
  state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0
  state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0
  state[4] = (state[4] + e) | 0; state[5] = (state[5] + f) | 0
  state[6] = (state[6] + g) | 0; state[7] = (state[7] + h) | 0
}

function writeByte(words: Int32Array, pos: number, byte: number) {
  words[pos >> 2] |= byte << (24 - (pos & 3) * 8)
}

// Builds a function that reports whether sha256(prefix + n) is the target,
// for ASCII prefixes (the salt is hex and a query string).
export function makeChecker(prefix: string, targetHex: string): (n: number) => boolean {
  const target = new Int32Array(8)
  for (let i = 0; i < 8; i++) target[i] = parseInt(targetHex.slice(i * 8, i * 8 + 8), 16) | 0

  const whole = prefix.length - (prefix.length % 64)
  const mid = new Int32Array(INIT)
  const head = new Int32Array(16)
  for (let off = 0; off < whole; off += 64) {
    head.fill(0)
    for (let i = 0; i < 64; i++) writeByte(head, i, prefix.charCodeAt(off + i))
    compress(mid, head, 0)
  }
  const tail = prefix.slice(whole)
  const base = new Int32Array(32)
  for (let i = 0; i < tail.length; i++) writeByte(base, i, tail.charCodeAt(i))
  // How many of the number's digits fit in the tail's first block.
  const fits = 64 - tail.length

  const state = new Int32Array(8)
  const buf = new Int32Array(32)
  const first = new Int32Array(8)
  let firstKey = ''
  return (n: number) => {
    const digits = String(n)
    const len = tail.length + digits.length
    buf.set(base)
    for (let i = 0; i < digits.length; i++) writeByte(buf, tail.length + i, digits.charCodeAt(i))
    writeByte(buf, len, 0x80)
    const blocks = len + 9 > 64 ? 2 : 1
    // The bit length of the whole message; it never needs the high word.
    buf[blocks * 16 - 1] = (whole + len) * 8
    state.set(mid)
    if (blocks === 1) {
      compress(state, buf, 0)
    } else {
      // The first block is the tail plus whatever of the number fits; a
      // shorter number also puts its end marker there, which the key's
      // length tells apart.
      const key = digits.length < fits ? digits : digits.slice(0, fits)
      if (key !== firstKey) {
        compress(state, buf, 0)
        first.set(state)
        firstKey = key
      } else {
        state.set(first)
      }
      compress(state, buf, 16)
    }
    for (let i = 0; i < 8; i++) if (state[i] !== target[i]) return false
    return true
  }
}

// How long to work between yields, so typing stays smooth.
const SLICE_MS = 12

// Resolves to the solution, or null when the instance has the check off,
// the solve was cancelled, or anything goes wrong. A null just means the
// signup goes to the waitlist, so it's never worth blocking the form on.
export async function solveSignupChallenge(instanceUrl: string, cancelled: () => boolean = () => false): Promise<SignupSolution | null> {
  try {
    const res = await authApi.signupChallengeWithUrl(instanceUrl)
    if (!res.data?.enabled) return null
    const { algorithm, challenge, maxnumber, salt, signature } = res.data.challenge
    if (algorithm !== 'SHA-256' || !/^[0-9a-f]{64}$/.test(challenge) || !/^[\x00-\x7f]*$/.test(salt)) return null
    const check = makeChecker(salt, challenge)
    let n = 0
    while (n <= maxnumber) {
      if (cancelled()) return null
      const until = Date.now() + SLICE_MS
      do {
        if (check(n)) return { algorithm, challenge, number: n, salt, signature }
        n++
      } while (n <= maxnumber && (n % 64 !== 0 || Date.now() < until))
      await new Promise(r => setTimeout(r, 0))
    }
  } catch { /* fall through to the waitlist */ }
  return null
}
