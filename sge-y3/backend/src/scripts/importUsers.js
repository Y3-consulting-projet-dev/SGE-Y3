const fs = require('fs');
const path = require('path');

const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const connectDB = require('../config/db');
const User = require('../models/User');
const {
  getGradeFromCategory,
  normalizeCategory,
  normalizeDepartment,
  normalizeEmail,
  normalizeText,
} = require('../utils/userMapping');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

const DEFAULT_PASSWORD = 'Ycube@c2026';
const DEFAULT_CSV_PATH = path.resolve(
  __dirname,
  '../../../../../../REGISTRE DU PERSONNEL (1).csv'
);

function parseCsvLine(line) {
  const [lastName = '', firstName = '', rawCategory = '', department = '', email = ''] = line.split(';');

  return {
    lastName: normalizeText(lastName),
    firstName: normalizeText(firstName),
    rawCategory: normalizeCategory(rawCategory),
    department: normalizeDepartment(department),
    email: normalizeEmail(email),
  };
}

function buildUserPayload(row, hashedPassword) {
  const grade = getGradeFromCategory(row.rawCategory);

  if (!row.lastName || !row.firstName || !row.email || !grade) {
    return null;
  }

  return {
    email: row.email,
    password: Buffer.from(hashedPassword, 'utf8'),
    name: `${row.firstName} ${row.lastName}`.trim(),
    last_name: row.lastName,
    first_name: row.firstName,
    grade,
    department: row.department,
    is_active: true,
    code_categorie: row.rawCategory,
  };
}

async function importUsers(csvPath) {
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const lines = fileContent
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

  const [, ...dataLines] = lines;
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const stats = {
    processed: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
  };

  for (const line of dataLines) {
    const row = parseCsvLine(line);

    if (!row.lastName && !row.firstName && !row.email) {
      continue;
    }

    stats.processed += 1;

    const payload = buildUserPayload(row, hashedPassword);

    if (!payload) {
      stats.skipped += 1;
      continue;
    }

    const existingUser = await User.findOne({ email: payload.email });

    if (existingUser) {
      existingUser.password = payload.password;
      existingUser.name = payload.name;
      existingUser.last_name = payload.last_name;
      existingUser.first_name = payload.first_name;
      existingUser.grade = payload.grade;
      existingUser.department = payload.department;
      existingUser.is_active = payload.is_active;
      existingUser.code_categorie = payload.code_categorie;

      await existingUser.save();
      stats.updated += 1;
      continue;
    }

    await User.create(payload);
    stats.imported += 1;
  }

  return stats;
}

async function main() {
  const csvPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_CSV_PATH;

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Fichier CSV introuvable: ${csvPath}`);
  }

  await connectDB();
  const stats = await importUsers(csvPath);

  console.log('Import termine.');
  console.log(stats);
}

main()
  .catch((error) => {
    console.error('Echec import utilisateurs:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await User.db.close();
    } catch (error) {
      console.error('Erreur fermeture connexion MongoDB:', error.message);
    }
  });
