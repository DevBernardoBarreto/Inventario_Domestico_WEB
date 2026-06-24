/**
 * database.js
 * ------------------------------------------------------------------
 * Responsável por:
 *  - Abrir/criar o arquivo de banco de dados SQLite (database.db)
 *  - Criar a tabela "itens" caso ainda não exista
 *  - Exportar a conexão (db) para ser usada pelos controllers
 * ------------------------------------------------------------------
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho absoluto do arquivo de banco de dados (fica dentro de /backend)
const DB_PATH = path.join(__dirname, 'database.db');

// Cria (ou abre, se já existir) o arquivo de banco de dados SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
  } else {
    console.log(`Conectado ao banco de dados SQLite em: ${DB_PATH}`);
  }
});

// Comando SQL de criação da tabela "itens", conforme especificação do projeto
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    local TEXT,
    descricao TEXT,
    marca TEXT,
    data_compra TEXT,
    valor_compra REAL
  )
`;

// Executa a criação da tabela assim que o módulo é carregado
db.run(CREATE_TABLE_SQL, (err) => {
  if (err) {
    console.error('Erro ao criar a tabela "itens":', err.message);
  } else {
    console.log('Tabela "itens" verificada/criada com sucesso.');
  }
});

module.exports = db;
