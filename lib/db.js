import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const dbPath = process.env.DATABASE_PATH || "./data/tickets.db";
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Seed data
  const adminExists = db
    .prepare("SELECT id FROM users WHERE role = 'admin'")
    .get();
  if (!adminExists) {
    const insert = db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
    insert.run("admin", "admin@tickets.local", bcrypt.hashSync("admin123", 12), "admin");
    insert.run("alice", "alice@example.com",   bcrypt.hashSync("alice123", 12), "user");
    insert.run("bob",   "bob@example.com",     bcrypt.hashSync("bob123",   12), "user");

    db.prepare(
      "INSERT INTO tickets (title, description, status, priority, user_id) VALUES (?, ?, ?, ?, ?)"
    ).run(
      "Problème de connexion",
      "Je ne peux pas me connecter depuis ce matin.",
      "open",
      "high",
      2
    );

    db.prepare(
      "INSERT INTO tickets (title, description, status, priority, user_id) VALUES (?, ?, ?, ?, ?)"
    ).run(
      "Mot de passe oublié",
      "J'ai perdu mon mot de passe, pouvez-vous le réinitialiser ?",
      "open",
      "medium",
      3
    );

    db.prepare(
      "INSERT INTO tickets (title, description, status, priority, user_id) VALUES (?, ?, ?, ?, ?)"
    ).run(
      "Facture incorrecte",
      "La facture du mois dernier contient une erreur de 50€.",
      "in_progress",
      "high",
      2
    );
  }
}

export { getDb };
