/**
 * itensController.js
 * ------------------------------------------------------------------
 * Contém toda a lógica de negócio (regras, validações e acesso ao
 * banco de dados) relacionada ao recurso "itens".
 *
 * As rotas (routes/itens.js) apenas direcionam as requisições HTTP
 * para as funções definidas aqui.
 * ------------------------------------------------------------------
 */

const db = require('../database');

/**
 * Remove tags HTML e espaços extras de uma string, ajudando a mitigar
 * ataques de XSS armazenado (Stored XSS) caso o dado venha a ser
 * exibido em algum lugar sem o devido escape no front-end.
 *
 * Mesmo o front-end usando textContent (que já neutraliza XSS na
 * exibição), sanitizamos também no backend como camada extra de
 * segurança ("defesa em profundidade").
 *
 * @param {*} valor - valor recebido do cliente
 * @returns {string|null} valor sanitizado ou null se vazio/ausente
 */
function sanitizarTexto(valor) {
  if (valor === undefined || valor === null) return null;

  const texto = String(valor).trim();
  if (texto === '') return null;

  // Remove qualquer tag HTML/script (ex: <script>, <img onerror=...>, etc.)
  const semTags = texto.replace(/<[^>]*>/g, '');

  return semTags;
}

/**
 * Valida e normaliza os dados de um item enviado pelo cliente.
 * Retorna um objeto { valido, erros, dados } onde:
 *  - valido: boolean indicando se passou todas as validações
 *  - erros: array de strings com as mensagens de erro encontradas
 *  - dados: objeto já sanitizado/normalizado, pronto para uso no SQL
 */
function validarItem(body) {
  const erros = [];

  const nome = sanitizarTexto(body.nome);
  const local = sanitizarTexto(body.local);
  const descricao = sanitizarTexto(body.descricao);
  const marca = sanitizarTexto(body.marca);
  const dataCompraBruta = sanitizarTexto(body.data_compra);
  const valorCompraBruto = body.valor_compra;

  // --- Validação: nome (obrigatório) ---
  if (!nome) {
    erros.push('O campo "nome" é obrigatório.');
  } else if (nome.length > 150) {
    erros.push('O campo "nome" deve ter no máximo 150 caracteres.');
  }

  // --- Validação: data_compra (opcional, mas se enviada deve ser uma data válida AAAA-MM-DD) ---
  let dataCompra = null;
  if (dataCompraBruta) {
    const regexData = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexData.test(dataCompraBruta) || Number.isNaN(new Date(dataCompraBruta).getTime())) {
      erros.push('O campo "data_compra" deve estar no formato AAAA-MM-DD.');
    } else {
      dataCompra = dataCompraBruta;
    }
  }

  // --- Validação: valor_compra (opcional, mas se enviado deve ser número >= 0) ---
  let valorCompra = null;
  if (valorCompraBruto !== undefined && valorCompraBruto !== null && valorCompraBruto !== '') {
    const numero = Number(valorCompraBruto);
    if (Number.isNaN(numero) || numero < 0) {
      erros.push('O campo "valor_compra" deve ser um número maior ou igual a zero.');
    } else {
      valorCompra = numero;
    }
  }

  // --- Validação de tamanho máximo para campos de texto livre ---
  if (local && local.length > 100) erros.push('O campo "local" deve ter no máximo 100 caracteres.');
  if (marca && marca.length > 100) erros.push('O campo "marca" deve ter no máximo 100 caracteres.');
  if (descricao && descricao.length > 1000) erros.push('O campo "descricao" deve ter no máximo 1000 caracteres.');

  return {
    valido: erros.length === 0,
    erros,
    dados: {
      nome,
      local,
      descricao,
      marca,
      data_compra: dataCompra,
      valor_compra: valorCompra,
    },
  };
}

/**
 * GET /api/itens
 * Lista todos os itens. Se houver query string "?nome=" realiza a
 * pesquisa (filtro) por nome, usada pela busca dinâmica do front-end.
 */
function listarItens(req, res) {
  const { nome } = req.query;

  let sql = 'SELECT * FROM itens';
  const params = [];

  if (nome && String(nome).trim() !== '') {
    sql += ' WHERE nome LIKE ?';
    params.push(`%${String(nome).trim()}%`);
  }

  sql += ' ORDER BY id DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Erro ao listar itens:', err.message);
      return res.status(500).json({ erro: 'Erro interno ao buscar os itens.' });
    }
    return res.status(200).json(rows);
  });
}

/**
 * GET /api/itens/:id
 * Retorna um único item pelo ID.
 */
function buscarItemPorId(req, res) {
  const { id } = req.params;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ erro: 'O ID informado é inválido.' });
  }

  db.get('SELECT * FROM itens WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Erro ao buscar item:', err.message);
      return res.status(500).json({ erro: 'Erro interno ao buscar o item.' });
    }
    if (!row) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }
    return res.status(200).json(row);
  });
}

/**
 * POST /api/itens
 * Cadastra um novo item no banco de dados.
 */
function criarItem(req, res) {
  const { valido, erros, dados } = validarItem(req.body || {});

  if (!valido) {
    return res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros });
  }

  const sql = `
    INSERT INTO itens (nome, local, descricao, marca, data_compra, valor_compra)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [
    dados.nome,
    dados.local,
    dados.descricao,
    dados.marca,
    dados.data_compra,
    dados.valor_compra,
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error('Erro ao criar item:', err.message);
      return res.status(500).json({ erro: 'Erro interno ao cadastrar o item.' });
    }

    // "this.lastID" é fornecido pelo sqlite3 e contém o ID do registro inserido
    db.get('SELECT * FROM itens WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) {
        console.error('Erro ao buscar item recém-criado:', err2.message);
        return res.status(201).json({ id: this.lastID, ...dados });
      }
      return res.status(201).json(row);
    });
  });
}

/**
 * PUT /api/itens/:id
 * Atualiza todos os campos de um item existente.
 */
function atualizarItem(req, res) {
  const { id } = req.params;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ erro: 'O ID informado é inválido.' });
  }

  const { valido, erros, dados } = validarItem(req.body || {});

  if (!valido) {
    return res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros });
  }

  // Verifica se o item existe antes de tentar atualizar
  db.get('SELECT * FROM itens WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Erro ao verificar item:', err.message);
      return res.status(500).json({ erro: 'Erro interno ao atualizar o item.' });
    }
    if (!row) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }

    const sql = `
      UPDATE itens
      SET nome = ?, local = ?, descricao = ?, marca = ?, data_compra = ?, valor_compra = ?
      WHERE id = ?
    `;
    const params = [
      dados.nome,
      dados.local,
      dados.descricao,
      dados.marca,
      dados.data_compra,
      dados.valor_compra,
      id,
    ];

    db.run(sql, params, (err2) => {
      if (err2) {
        console.error('Erro ao atualizar item:', err2.message);
        return res.status(500).json({ erro: 'Erro interno ao atualizar o item.' });
      }

      db.get('SELECT * FROM itens WHERE id = ?', [id], (err3, itemAtualizado) => {
        if (err3) {
          console.error('Erro ao buscar item atualizado:', err3.message);
          return res.status(200).json({ id: Number(id), ...dados });
        }
        return res.status(200).json(itemAtualizado);
      });
    });
  });
}

/**
 * DELETE /api/itens/:id
 * Remove um item do banco de dados.
 */
function excluirItem(req, res) {
  const { id } = req.params;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ erro: 'O ID informado é inválido.' });
  }

  db.get('SELECT * FROM itens WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Erro ao verificar item:', err.message);
      return res.status(500).json({ erro: 'Erro interno ao excluir o item.' });
    }
    if (!row) {
      return res.status(404).json({ erro: 'Item não encontrado.' });
    }

    db.run('DELETE FROM itens WHERE id = ?', [id], (err2) => {
      if (err2) {
        console.error('Erro ao excluir item:', err2.message);
        return res.status(500).json({ erro: 'Erro interno ao excluir o item.' });
      }
      return res.status(200).json({ mensagem: 'Item excluído com sucesso.', id: Number(id) });
    });
  });
}

/**
 * GET /api/itens/estatisticas/resumo
 * Calcula e retorna os indicadores usados no dashboard e no resumo
 * do inventário:
 *  - total de itens
 *  - valor total do patrimônio (soma de valor_compra)
 *  - valor médio dos itens
 *  - quantidade de marcas diferentes cadastradas (não nulas)
 *  - local com maior quantidade de itens (e quantos itens ele tem)
 *  - item mais caro cadastrado
 *
 * Todos os cálculos são feitos via SQL para não depender de carregar
 * a lista inteira no servidor.
 */
function obterEstatisticas(req, res) {
  // Consulta 1: agregados gerais (contagem, soma, média, marcas distintas)
  const sqlResumo = `
    SELECT
      COUNT(*) AS total_itens,
      COALESCE(SUM(valor_compra), 0) AS valor_total,
      COALESCE(AVG(valor_compra), 0) AS valor_medio,
      COUNT(DISTINCT CASE WHEN marca IS NOT NULL AND TRIM(marca) <> '' THEN marca END) AS total_marcas
    FROM itens
  `;

  // Consulta 2: local com maior quantidade de itens
  const sqlLocalTop = `
    SELECT local, COUNT(*) AS quantidade
    FROM itens
    WHERE local IS NOT NULL AND TRIM(local) <> ''
    GROUP BY local
    ORDER BY quantidade DESC, local ASC
    LIMIT 1
  `;

  // Consulta 3: item mais caro cadastrado
  const sqlItemMaisCaro = `
    SELECT *
    FROM itens
    WHERE valor_compra IS NOT NULL
    ORDER BY valor_compra DESC
    LIMIT 1
  `;

  db.get(sqlResumo, [], (err, resumo) => {
    if (err) {
      console.error('Erro ao calcular estatísticas (resumo):', err.message);
      return res.status(500).json({ erro: 'Erro interno ao calcular estatísticas.' });
    }

    db.get(sqlLocalTop, [], (err2, localTop) => {
      if (err2) {
        console.error('Erro ao calcular estatísticas (local top):', err2.message);
        return res.status(500).json({ erro: 'Erro interno ao calcular estatísticas.' });
      }

      db.get(sqlItemMaisCaro, [], (err3, itemMaisCaro) => {
        if (err3) {
          console.error('Erro ao calcular estatísticas (item mais caro):', err3.message);
          return res.status(500).json({ erro: 'Erro interno ao calcular estatísticas.' });
        }

        return res.status(200).json({
          total_itens: resumo.total_itens || 0,
          valor_total: resumo.valor_total || 0,
          valor_medio: resumo.valor_medio || 0,
          total_marcas: resumo.total_marcas || 0,
          local_top: localTop ? localTop.local : null,
          local_top_quantidade: localTop ? localTop.quantidade : 0,
          item_mais_caro: itemMaisCaro || null,
        });
      });
    });
  });
}

module.exports = {
  listarItens,
  buscarItemPorId,
  criarItem,
  atualizarItem,
  excluirItem,
  obterEstatisticas,
};
