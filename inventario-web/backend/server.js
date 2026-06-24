/**
 * server.js
 * ------------------------------------------------------------------
 * Ponto de entrada da aplicação back-end.
 *  - Configura o servidor Express
 *  - Aplica middlewares globais (CORS, JSON parser)
 *  - Serve os arquivos estáticos do front-end (HTML/CSS/JS puro)
 *  - Registra as rotas da API REST em /api/itens
 * ------------------------------------------------------------------
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Garante que o banco de dados e a tabela sejam inicializados
require('./database');

const itensRoutes = require('./routes/itens');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares globais ---
app.use(cors()); // Permite requisições de outras origens (útil em ambiente de desenvolvimento)
app.use(express.json()); // Faz o parsing automático de corpos de requisição em JSON
app.use(express.urlencoded({ extended: true })); // Suporte a dados de formulário url-encoded

// --- Arquivos estáticos do front-end (HTML, CSS, JS puro) ---
const FRONTEND_PATH = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_PATH));

// --- Rotas da API REST ---
app.use('/api/itens', itensRoutes);

// Rota de verificação rápida da API (health check)
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', mensagem: 'API do Inventário Doméstico Web está funcionando.' });
});

// Qualquer outra rota não reconhecida pela API retorna o index.html
// (suporte simples de fallback para navegação no front-end)
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

// --- Tratamento de rota da API não encontrada ---
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada.' });
});

// --- Inicialização do servidor ---
app.listen(PORT, () => {
  console.log('==================================================');
  console.log(' Inventário Doméstico Web');
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
  console.log(`API disponível em:  http://localhost:${PORT}/api/itens`);
  console.log('==================================================');
});
