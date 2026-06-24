/**
 * routes/itens.js
 * ------------------------------------------------------------------
 * Define as rotas (endpoints) da API REST para o recurso "itens".
 * Cada rota delega o tratamento da requisição para o controller
 * correspondente, mantendo este arquivo simples e organizado.
 * ------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const itensController = require('../controllers/itensController');

// GET /api/itens         -> lista todos os itens (aceita ?nome= para pesquisa)
router.get('/', itensController.listarItens);

// GET /api/itens/estatisticas/resumo -> indicadores do dashboard e resumo do inventário
// IMPORTANTE: esta rota precisa ser declarada ANTES de "/:id", caso contrário o
// Express interpretaria "estatisticas" como um valor de :id.
router.get('/estatisticas/resumo', itensController.obterEstatisticas);

// GET /api/itens/:id     -> busca um item específico pelo ID
router.get('/:id', itensController.buscarItemPorId);

// POST /api/itens        -> cadastra um novo item
router.post('/', itensController.criarItem);

// PUT /api/itens/:id     -> atualiza um item existente
router.put('/:id', itensController.atualizarItem);

// DELETE /api/itens/:id  -> remove um item existente
router.delete('/:id', itensController.excluirItem);

module.exports = router;
