/**
 * app.js
 * ------------------------------------------------------------------
 * Lógica do front-end (JavaScript puro, sem frameworks).
 *
 * Responsável por:
 *  - Buscar itens na API (fetch) e renderizar a tabela
 *  - Calcular/exibir o dashboard de indicadores e o resumo do inventário
 *  - Cadastrar (formulário principal) e editar (modal) itens
 *  - Pesquisa dinâmica por nome, com mensagem de "nada encontrado"
 *  - Ordenação da tabela por coluna (crescente/decrescente)
 *  - Exibir confirmação antes de excluir
 *  - Validações amigáveis no cliente (nome, valor, data)
 *
 * SEGURANÇA (XSS):
 *  - Nunca usamos innerHTML com dados vindos do usuário/servidor.
 *  - Toda a montagem de linhas da tabela é feita criando elementos
 *    via document.createElement() e preenchendo o conteúdo textual
 *    com textContent, que NÃO interpreta HTML/JS.
 * ------------------------------------------------------------------
 */

(function () {
  'use strict';

  // -------------------- Configuração --------------------
  const API_URL = '/api/itens';
  const API_ESTATISTICAS_URL = '/api/itens/estatisticas/resumo';

  // -------------------- Estado em memória --------------------
  let itensAtuais = [];           // último conjunto de itens recebido da API (já filtrado pela pesquisa)
  let ordenacao = { campo: null, direcao: 'asc' }; // estado da ordenação da tabela
  let idParaExcluir = null;       // item pendente de exclusão (modal de confirmação)
  let timeoutPesquisa = null;     // debounce da pesquisa

  // -------------------- Referências do DOM: dashboard --------------------
  const indicadorTotalItens = document.getElementById('indicadorTotalItens');
  const indicadorValorTotal = document.getElementById('indicadorValorTotal');
  const indicadorTotalMarcas = document.getElementById('indicadorTotalMarcas');
  const indicadorLocalTop = document.getElementById('indicadorLocalTop');

  // -------------------- Referências do DOM: resumo --------------------
  const resumoTotalItens = document.getElementById('resumoTotalItens');
  const resumoValorTotal = document.getElementById('resumoValorTotal');
  const resumoValorMedio = document.getElementById('resumoValorMedio');
  const resumoItemMaisCaro = document.getElementById('resumoItemMaisCaro');

  // -------------------- Referências do DOM: formulário de cadastro --------------------
  const formItem = document.getElementById('formItem');
  const inputNome = document.getElementById('nome');
  const inputLocal = document.getElementById('local');
  const inputDescricao = document.getElementById('descricao');
  const inputMarca = document.getElementById('marca');
  const inputDataCompra = document.getElementById('data_compra');
  const inputValorCompra = document.getElementById('valor_compra');
  const formErro = document.getElementById('formErro');
  const botaoSalvar = document.getElementById('botaoSalvar');

  // -------------------- Referências do DOM: pesquisa e tabela --------------------
  const pesquisaNome = document.getElementById('pesquisaNome');
  const corpoTabela = document.getElementById('corpoTabela');
  const mensagemVazia = document.getElementById('mensagemVazia');
  const mensagemCarregando = document.getElementById('mensagemCarregando');
  const cabecalhosOrdenaveis = document.querySelectorAll('.tabela thead th.ordenavel');

  // -------------------- Referências do DOM: modal de edição --------------------
  const modalEdicao = document.getElementById('modalEdicao');
  const formEdicao = document.getElementById('formEdicao');
  const editId = document.getElementById('editId');
  const editNome = document.getElementById('editNome');
  const editLocal = document.getElementById('editLocal');
  const editDescricao = document.getElementById('editDescricao');
  const editMarca = document.getElementById('editMarca');
  const editDataCompra = document.getElementById('editDataCompra');
  const editValorCompra = document.getElementById('editValorCompra');
  const formEdicaoErro = document.getElementById('formEdicaoErro');
  const botaoSalvarEdicao = document.getElementById('botaoSalvarEdicao');
  const botaoCancelarEdicao = document.getElementById('botaoCancelarEdicao');
  const botaoFecharModalEdicao = document.getElementById('botaoFecharModalEdicao');

  // -------------------- Referências do DOM: modal de exclusão --------------------
  const modalConfirmacao = document.getElementById('modalConfirmacao');
  const modalTexto = document.getElementById('modalTexto');
  const botaoModalCancelar = document.getElementById('botaoModalCancelar');
  const botaoModalConfirmar = document.getElementById('botaoModalConfirmar');

  // -------------------- Toasts --------------------
  const toastArea = document.getElementById('toastArea');

  // ====================================================================
  // FUNÇÕES UTILITÁRIAS
  // ====================================================================

  /**
   * Formata um valor numérico como moeda brasileira (R$ 0,00).
   */
  function formatarMoeda(valor) {
    const numero = Number(valor);
    if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) {
      return 'R$ 0,00';
    }
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /**
   * Formata uma data no formato AAAA-MM-DD para DD/MM/AAAA.
   */
  function formatarData(dataIso) {
    if (!dataIso) return '—';
    const partes = String(dataIso).split('-');
    if (partes.length !== 3) return '—';
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  }

  /**
   * Verifica se uma string de data no formato AAAA-MM-DD é uma data
   * real e válida (ex: rejeita 2024-02-30).
   */
  function dataEhValida(valor) {
    if (!valor) return true; // campo opcional vazio é válido
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(valor)) return false;
    const [ano, mes, dia] = valor.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  }

  /**
   * Exibe uma notificação temporária (toast) no canto da tela.
   * Usa textContent para inserir a mensagem com segurança.
   */
  function exibirToast(mensagem, tipo = 'sucesso') {
    const toast = document.createElement('div');
    toast.className = tipo === 'erro' ? 'toast toast--erro' : 'toast';
    toast.textContent = mensagem; // seguro contra XSS
    toastArea.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  /**
   * Liga/desliga o estado de erro visual (borda vermelha) de um campo.
   */
  function marcarCampoInvalido(elementoInput, elementoErro, mensagem) {
    if (mensagem) {
      elementoInput.classList.add('campo--invalido');
      elementoErro.textContent = mensagem; // seguro contra XSS
      elementoErro.hidden = false;
    } else {
      elementoInput.classList.remove('campo--invalido');
      elementoErro.textContent = '';
      elementoErro.hidden = true;
    }
  }

  /**
   * Exibe (ou esconde) a mensagem de erro geral de um formulário.
   */
  function exibirErroFormulario(elementoErro, mensagens) {
    if (!mensagens || (Array.isArray(mensagens) && mensagens.length === 0)) {
      elementoErro.hidden = true;
      elementoErro.textContent = '';
      return;
    }
    const texto = Array.isArray(mensagens) ? mensagens.join('\n') : String(mensagens);
    elementoErro.textContent = texto; // seguro contra XSS
    elementoErro.hidden = false;
  }

  // ====================================================================
  // VALIDAÇÃO NO CLIENTE (mensagens amigáveis, validação real fica no backend)
  // ====================================================================

  /**
   * Valida os campos de um formulário (cadastro ou edição) e aplica
   * feedback visual (borda + mensagem) em cada campo problemático.
   *
   * @param {object} dados - { nome, valor_compra, data_compra }
   * @param {object} elementos - referências dos inputs e dos spans de erro
   * @returns {string[]} lista de mensagens de erro (vazia se tudo válido)
   */
  function validarFormulario(dados, elementos) {
    const erros = [];

    // Nome: obrigatório e não pode ser apenas espaços em branco
    if (!dados.nome || dados.nome.trim() === '') {
      marcarCampoInvalido(elementos.nome, elementos.erroNome, 'Informe o nome do item.');
      erros.push('O nome do item é obrigatório.');
    } else {
      marcarCampoInvalido(elementos.nome, elementos.erroNome, null);
    }

    // Valor: se informado, deve ser maior que zero
    if (dados.valor_compra !== null && dados.valor_compra !== '') {
      const numero = Number(dados.valor_compra);
      if (Number.isNaN(numero) || numero <= 0) {
        marcarCampoInvalido(elementos.valor, elementos.erroValor, 'O valor deve ser maior que zero.');
        erros.push('O valor da compra deve ser maior que zero.');
      } else {
        marcarCampoInvalido(elementos.valor, elementos.erroValor, null);
      }
    } else {
      marcarCampoInvalido(elementos.valor, elementos.erroValor, null);
    }

    // Data: se informada, precisa ser uma data real
    if (dados.data_compra && !dataEhValida(dados.data_compra)) {
      marcarCampoInvalido(elementos.data, elementos.erroData, 'Informe uma data válida.');
      erros.push('A data da compra informada não é válida.');
    } else {
      marcarCampoInvalido(elementos.data, elementos.erroData, null);
    }

    return erros;
  }

  // ====================================================================
  // COMUNICAÇÃO COM A API
  // ====================================================================

  /**
   * Busca os itens na API. Se "termo" for informado, envia como
   * query string para o backend filtrar pelo nome.
   */
  async function buscarItens(termo) {
    mensagemCarregando.hidden = false;
    mensagemVazia.hidden = true;

    try {
      const url = termo
        ? `${API_URL}?nome=${encodeURIComponent(termo)}`
        : API_URL;

      const resposta = await fetch(url);

      if (!resposta.ok) {
        throw new Error('Não foi possível carregar os itens.');
      }

      const itens = await resposta.json();
      itensAtuais = itens;
      renderizarTabela();
    } catch (erro) {
      console.error(erro);
      exibirToast('Erro ao carregar itens. Verifique se o servidor está rodando.', 'erro');
      itensAtuais = [];
      renderizarTabela();
    } finally {
      mensagemCarregando.hidden = true;
    }
  }

  /**
   * Busca os indicadores agregados (dashboard + resumo) na API.
   */
  async function buscarEstatisticas() {
    try {
      const resposta = await fetch(API_ESTATISTICAS_URL);
      if (!resposta.ok) throw new Error('Não foi possível carregar as estatísticas.');
      const dados = await resposta.json();
      renderizarDashboard(dados);
      renderizarResumo(dados);
    } catch (erro) {
      console.error(erro);
      // Falha nas estatísticas não deve travar o resto da aplicação.
    }
  }

  /**
   * Atualiza tabela e indicadores juntos — chamado após qualquer
   * operação que altere os dados (criar, editar, excluir).
   */
  function atualizarTudo() {
    buscarItens(pesquisaNome.value.trim());
    buscarEstatisticas();
  }

  /**
   * Envia os dados de um novo item para a API (POST).
   */
  async function criarItemApi(dados) {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const detalhes = corpo && corpo.detalhes ? corpo.detalhes : [corpo.erro || 'Erro ao cadastrar o item.'];
      const erro = new Error('Falha na validação');
      erro.detalhes = detalhes;
      throw erro;
    }
    return corpo;
  }

  /**
   * Envia os dados de um item existente para a API (PUT).
   */
  async function atualizarItemApi(id, dados) {
    const resposta = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const detalhes = corpo && corpo.detalhes ? corpo.detalhes : [corpo.erro || 'Erro ao atualizar o item.'];
      const erro = new Error('Falha na validação');
      erro.detalhes = detalhes;
      throw erro;
    }
    return corpo;
  }

  /**
   * Solicita a exclusão de um item à API.
   */
  async function excluirItemApi(id) {
    const resposta = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(corpo.erro || 'Erro ao excluir o item.');
    }
    return corpo;
  }

  // ====================================================================
  // RENDERIZAÇÃO DO DASHBOARD E DO RESUMO (sem innerHTML)
  // ====================================================================

  function renderizarDashboard(stats) {
    indicadorTotalItens.textContent = String(stats.total_itens ?? 0);
    indicadorValorTotal.textContent = formatarMoeda(stats.valor_total);
    indicadorTotalMarcas.textContent = String(stats.total_marcas ?? 0);
    indicadorLocalTop.textContent = stats.local_top ? stats.local_top : '—';
  }

  function renderizarResumo(stats) {
    resumoTotalItens.textContent = String(stats.total_itens ?? 0);
    resumoValorTotal.textContent = formatarMoeda(stats.valor_total);
    resumoValorMedio.textContent = formatarMoeda(stats.valor_medio);

    if (stats.item_mais_caro) {
      const item = stats.item_mais_caro;
      resumoItemMaisCaro.textContent = `${item.nome} — ${formatarMoeda(item.valor_compra)}`;
    } else {
      resumoItemMaisCaro.textContent = '—';
    }
  }

  // ====================================================================
  // ORDENAÇÃO DA TABELA
  // ====================================================================

  /**
   * Retorna uma nova lista de itens ordenada conforme o estado atual
   * de "ordenacao" (campo + direção). Não modifica o array original.
   */
  function obterItensOrdenados() {
    if (!ordenacao.campo) return itensAtuais;

    const lista = [...itensAtuais];
    const { campo, direcao } = ordenacao;

    lista.sort((a, b) => {
      let valorA = a[campo];
      let valorB = b[campo];

      if (campo === 'valor_compra') {
        valorA = valorA === null || valorA === undefined ? -Infinity : Number(valorA);
        valorB = valorB === null || valorB === undefined ? -Infinity : Number(valorB);
      } else if (campo === 'data_compra') {
        valorA = valorA || '';
        valorB = valorB || '';
      } else {
        valorA = (valorA || '').toString().toLowerCase();
        valorB = (valorB || '').toString().toLowerCase();
      }

      if (valorA < valorB) return direcao === 'asc' ? -1 : 1;
      if (valorA > valorB) return direcao === 'asc' ? 1 : -1;
      return 0;
    });

    return lista;
  }

  /**
   * Atualiza a indicação visual (seta + destaque) do cabeçalho
   * de coluna que está ativo na ordenação.
   */
  function atualizarIndicadoresOrdenacao() {
    cabecalhosOrdenaveis.forEach((th) => {
      const seta = th.querySelector('.seta-ordenacao');
      if (th.dataset.campo === ordenacao.campo) {
        th.classList.add('ordenavel--ativa');
        seta.textContent = ordenacao.direcao === 'asc' ? '▲' : '▼';
      } else {
        th.classList.remove('ordenavel--ativa');
        seta.textContent = '';
      }
    });
  }

  cabecalhosOrdenaveis.forEach((th) => {
    th.setAttribute('tabindex', '0');
    th.setAttribute('role', 'button');

    function alternarOrdenacao() {
      const campo = th.dataset.campo;
      if (ordenacao.campo === campo) {
        ordenacao.direcao = ordenacao.direcao === 'asc' ? 'desc' : 'asc';
      } else {
        ordenacao.campo = campo;
        ordenacao.direcao = 'asc';
      }
      atualizarIndicadoresOrdenacao();
      renderizarTabela();
    }

    th.addEventListener('click', alternarOrdenacao);
    th.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        alternarOrdenacao();
      }
    });
  });

  // ====================================================================
  // RENDERIZAÇÃO DA TABELA (sem innerHTML — apenas textContent)
  // ====================================================================

  function renderizarTabela() {
    corpoTabela.textContent = ''; // limpa linhas atuais

    const itens = obterItensOrdenados();

    if (!itens || itens.length === 0) {
      mensagemVazia.hidden = false;
      mensagemVazia.textContent = pesquisaNome.value.trim()
        ? 'Nenhum item encontrado para esta pesquisa.'
        : 'Nenhum item cadastrado ainda.';
      return;
    }

    mensagemVazia.hidden = true;

    itens.forEach((item) => {
      corpoTabela.appendChild(criarLinhaTabela(item));
    });
  }

  function criarLinhaTabela(item) {
    const tr = document.createElement('tr');

    tr.appendChild(criarCelula(item.id, 'coluna-id'));
    tr.appendChild(criarCelula(item.nome));
    tr.appendChild(criarCelula(item.local || '—'));
    tr.appendChild(criarCelula(item.marca || '—'));
    tr.appendChild(criarCelula(formatarData(item.data_compra)));
    tr.appendChild(criarCelula(formatarMoeda(item.valor_compra), 'coluna-valor'));
    tr.appendChild(criarCelulaAcoes(item));

    return tr;
  }

  function criarCelula(valor, classeExtra) {
    const td = document.createElement('td');
    if (classeExtra) td.classList.add(classeExtra);
    td.textContent = valor === null || valor === undefined ? '—' : String(valor);
    return td;
  }

  function criarCelulaAcoes(item) {
    const td = document.createElement('td');
    td.classList.add('coluna-acoes');

    const botaoEditar = document.createElement('button');
    botaoEditar.type = 'button';
    botaoEditar.className = 'botao botao--secundario botao--mini';
    botaoEditar.textContent = 'Editar';
    botaoEditar.addEventListener('click', () => abrirModalEdicao(item));

    const botaoExcluir = document.createElement('button');
    botaoExcluir.type = 'button';
    botaoExcluir.className = 'botao botao--perigo botao--mini';
    botaoExcluir.textContent = 'Excluir';
    botaoExcluir.addEventListener('click', () => abrirModalConfirmacao(item));

    td.appendChild(botaoEditar);
    td.appendChild(botaoExcluir);

    return td;
  }

  // ====================================================================
  // FORMULÁRIO DE CADASTRO (painel lateral)
  // ====================================================================

  function lerDadosFormularioCadastro() {
    return {
      nome: inputNome.value.trim(),
      local: inputLocal.value.trim(),
      descricao: inputDescricao.value.trim(),
      marca: inputMarca.value.trim(),
      data_compra: inputDataCompra.value || null,
      valor_compra: inputValorCompra.value === '' ? null : Number(inputValorCompra.value),
    };
  }

  function resetarFormularioCadastro() {
    formItem.reset();
    exibirErroFormulario(formErro, null);
    [inputNome, inputDataCompra, inputValorCompra].forEach((campo) => campo.classList.remove('campo--invalido'));
    document.getElementById('erroNome').hidden = true;
    document.getElementById('erroData').hidden = true;
    document.getElementById('erroValor').hidden = true;
  }

  formItem.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const dados = lerDadosFormularioCadastro();
    const erros = validarFormulario(dados, {
      nome: inputNome,
      erroNome: document.getElementById('erroNome'),
      valor: inputValorCompra,
      erroValor: document.getElementById('erroValor'),
      data: inputDataCompra,
      erroData: document.getElementById('erroData'),
    });

    if (erros.length > 0) {
      exibirErroFormulario(formErro, erros);
      return;
    }

    botaoSalvar.disabled = true;
    try {
      await criarItemApi(dados);
      exibirErroFormulario(formErro, null);
      exibirToast('Item cadastrado com sucesso.');
      resetarFormularioCadastro();
      atualizarTudo();
    } catch (erro) {
      console.error(erro);
      exibirErroFormulario(formErro, erro.detalhes || [erro.message]);
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  // ====================================================================
  // MODAL DE EDIÇÃO
  // ====================================================================

  function abrirModalEdicao(item) {
    editId.value = item.id;
    editNome.value = item.nome || '';
    editLocal.value = item.local || '';
    editDescricao.value = item.descricao || '';
    editMarca.value = item.marca || '';
    editDataCompra.value = item.data_compra || '';
    editValorCompra.value = item.valor_compra ?? '';

    exibirErroFormulario(formEdicaoErro, null);
    [editNome, editDataCompra, editValorCompra].forEach((campo) => campo.classList.remove('campo--invalido'));
    document.getElementById('erroEditNome').hidden = true;
    document.getElementById('erroEditData').hidden = true;
    document.getElementById('erroEditValor').hidden = true;

    modalEdicao.hidden = false;
    editNome.focus();
  }

  function fecharModalEdicao() {
    modalEdicao.hidden = true;
    formEdicao.reset();
  }

  function lerDadosFormularioEdicao() {
    return {
      nome: editNome.value.trim(),
      local: editLocal.value.trim(),
      descricao: editDescricao.value.trim(),
      marca: editMarca.value.trim(),
      data_compra: editDataCompra.value || null,
      valor_compra: editValorCompra.value === '' ? null : Number(editValorCompra.value),
    };
  }

  formEdicao.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const id = editId.value;
    const dados = lerDadosFormularioEdicao();
    const erros = validarFormulario(dados, {
      nome: editNome,
      erroNome: document.getElementById('erroEditNome'),
      valor: editValorCompra,
      erroValor: document.getElementById('erroEditValor'),
      data: editDataCompra,
      erroData: document.getElementById('erroEditData'),
    });

    if (erros.length > 0) {
      exibirErroFormulario(formEdicaoErro, erros);
      return;
    }

    botaoSalvarEdicao.disabled = true;
    try {
      await atualizarItemApi(id, dados);
      exibirToast('Item atualizado com sucesso.');
      fecharModalEdicao();
      atualizarTudo();
    } catch (erro) {
      console.error(erro);
      exibirErroFormulario(formEdicaoErro, erro.detalhes || [erro.message]);
    } finally {
      botaoSalvarEdicao.disabled = false;
    }
  });

  botaoCancelarEdicao.addEventListener('click', fecharModalEdicao);
  botaoFecharModalEdicao.addEventListener('click', fecharModalEdicao);

  modalEdicao.addEventListener('click', (evento) => {
    if (evento.target === modalEdicao) fecharModalEdicao();
  });

  // ====================================================================
  // MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
  // ====================================================================

  function abrirModalConfirmacao(item) {
    idParaExcluir = item.id;
    modalTexto.textContent = `O item "${item.nome}" (ID ${item.id}) será removido permanentemente.`;
    modalConfirmacao.hidden = false;
    botaoModalConfirmar.focus();
  }

  function fecharModalConfirmacao() {
    idParaExcluir = null;
    modalConfirmacao.hidden = true;
  }

  botaoModalCancelar.addEventListener('click', fecharModalConfirmacao);

  modalConfirmacao.addEventListener('click', (evento) => {
    if (evento.target === modalConfirmacao) fecharModalConfirmacao();
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    if (!modalConfirmacao.hidden) fecharModalConfirmacao();
    if (!modalEdicao.hidden) fecharModalEdicao();
  });

  botaoModalConfirmar.addEventListener('click', async () => {
    if (!idParaExcluir) return;

    botaoModalConfirmar.disabled = true;
    try {
      await excluirItemApi(idParaExcluir);
      exibirToast('Item removido com sucesso.');
      fecharModalConfirmacao();
      atualizarTudo();
    } catch (erro) {
      console.error(erro);
      exibirToast(erro.message || 'Erro ao excluir o item.', 'erro');
      fecharModalConfirmacao();
    } finally {
      botaoModalConfirmar.disabled = false;
    }
  });

  // ====================================================================
  // PESQUISA DINÂMICA
  // ====================================================================

  pesquisaNome.addEventListener('input', () => {
    clearTimeout(timeoutPesquisa);
    timeoutPesquisa = setTimeout(() => {
      buscarItens(pesquisaNome.value.trim());
    }, 300);
  });

  // ====================================================================
  // INICIALIZAÇÃO
  // ====================================================================

  function iniciar() {
    buscarItens();
    buscarEstatisticas();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
