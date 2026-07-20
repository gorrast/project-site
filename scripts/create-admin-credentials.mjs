#!/usr/bin/env node
// Usage: node scripts/create-admin-credentials.mjs <username> <password>
import crypto from 'crypto'

const [,, username, password] = process.argv

if (!username || !password) {
  console.error('Usage: node scripts/create-admin-credentials.mjs <username> <password>')
  process.exit(1)
}

const salt = crypto.randomBytes(16).toString('hex')
const hash = crypto.createHash('sha256').update(salt + password).digest('hex')

console.log('\nRun this SQL in the Supabase SQL Editor:\n')
console.log(`INSERT INTO admin_credentials (username, password_hash, salt)`)
console.log(`VALUES ('${username}', '${hash}', '${salt}');`)
console.log('\nKeep your password safe — it cannot be recovered from this hash.\n')
