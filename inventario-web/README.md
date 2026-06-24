# 📦 Inventário Doméstico Web

Sistema **Full Stack** para gerenciamento dos bens e objetos de uma residência, desenvolvido como projeto acadêmico para a disciplina de **Desenvolvimento Web**.

Permite cadastrar, listar, pesquisar, editar e excluir itens do inventário doméstico (nome, local de armazenamento, descrição, marca, data e valor da compra), com persistência em banco de dados **SQLite**.

---

## 📑 Sumário

- [Tecnologias utilizadas](#-tecnologias-utilizadas)
- [Estrutura de pastas](#-estrutura-de-pastas)
- [Como instalar](#-como-instalar)
- [Como executar](#-como-executar)
- [Banco de dados](#-banco-de-dados)
- [Endpoints da API](#-endpoints-da-api)
- [Exemplos de uso](#-exemplos-de-uso)
- [Segurança](#-segurança)
- [Funcionalidades do frontend](#-funcionalidades-do-frontend)
- [Possíveis problemas e soluções](#-possíveis-problemas-e-soluções)

---

## 🛠 Tecnologias utilizadas

**Frontend**
- HTML5
- CSS3 (sem frameworks como Bootstrap/Tailwind — CSS escrito à mão)
- JavaScript puro (Vanilla JS, sem frameworks como React/Vue/Angular)
- `fetch()` para comunicação com a API REST

**Backend**
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/) — framework para criação da API REST
- [cors](https://www.npmjs.com/package/cors) — liberação de requisições cross-origin (ambiente de desenvolvimento)

**Banco de dados**
- [SQLite](https://www.sqlite.org/) via pacote [`sqlite3`](https://www.npmjs.com/package/sqlite3) — banco de dados leve, em arquivo único (`database.db`), sem necessidade de servidor de banco de dados separado

**Arquitetura**
- Cliente-servidor: o front-end (HTML/CSS/JS) consome uma API REST fornecida pelo back-end (Node/Express), que por sua vez persiste os dados em SQLite.

---

## 📁 Estrutura de pastas

```
inventario-web/
│
├── backend/
│   ├── server.js                  # Ponto de entrada do servidor Express
│   ├── database.js                # Conexão e criação da tabela SQLite
│   ├── routes/
│   │   └── itens.js               # Definição das rotas da API REST
│   ├── controllers/
│   │   └── itensController.js     # Regras de negócio, validação e acesso ao banco
│   └── database.db                # Arquivo do banco SQLite (criado automaticamente)
│
├── frontend/
│   ├── index.html                 # Página principal (formulário + tabela)
│   ├── css/
│   │   └── style.css              # Estilos da interface
│   └── js/
│       └── app.js                 # Lógica do front-end (fetch, DOM, eventos)
│
├── package.json                   # Dependências e scripts do projeto
└── README.md                      # Esta documentação
```

> O arquivo `backend/database.db` é criado automaticamente na primeira execução do servidor — não é necessário criá-lo manualmente.

---

## ⚙️ Como instalar

### Pré-requisitos

- [Node.js](https://nodejs.org/) versão **16 ou superior** instalado (inclui o `npm`)
- Não é necessário instalar SQLite separadamente — o pacote `sqlite3` já inclui o motor do banco de dados

### Passos

1. Extraia/clone o projeto em uma pasta de sua preferência e acesse a raiz do projeto:

```bash
cd inventario-web
```

2. Instale as dependências do projeto:

```bash
npm install
```

Esse comando irá instalar:
- `express` — framework do servidor
- `sqlite3` — driver do banco de dados SQLite
- `cors` — middleware de CORS

---

## ▶️ Como executar

Após a instalação das dependências, inicie o servidor com:

```bash
npm start
```

Você verá uma saída semelhante a:

```
Conectado ao banco de dados SQLite em: .../backend/database.db
Tabela "itens" verificada/criada com sucesso.
==================================================
 Inventário Doméstico Web
Servidor rodando em: http://localhost:3000
API disponível em:  http://localhost:3000/api/itens
==================================================
```

3. Abra o navegador e acesse:

```
http://localhost:3000
```

A interface do **Inventário Doméstico Web** será carregada, já consumindo a API automaticamente.

> 💡 A porta padrão é `3000`. Para utilizar outra porta, defina a variável de ambiente `PORT` antes de iniciar, por exemplo: `PORT=4000 npm start`.

---

## 🗄 Banco de dados

O projeto utiliza **SQLite**, com o banco de dados persistido em um único arquivo: `backend/database.db`. Esse arquivo é criado e a tabela abaixo é provisionada automaticamente pelo `backend/database.js` na primeira execução do servidor.

```sql
CREATE TABLE IF NOT EXISTS itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    local TEXT,
    descricao TEXT,
    marca TEXT,
    data_compra TEXT,
    valor_compra REAL
);
```

| Campo          | Tipo    | Obrigatório | Descrição                                   |
|----------------|---------|:-----------:|----------------------------------------------|
| `id`           | INTEGER | automático  | Identificador único, gerado automaticamente  |
| `nome`         | TEXT    | ✅ sim      | Nome do item                                 |
| `local`        | TEXT    | não         | Local onde o item está armazenado            |
| `descricao`    | TEXT    | não         | Descrição livre do item                      |
| `marca`        | TEXT    | não         | Marca/fabricante do item                     |
| `data_compra`  | TEXT    | não         | Data da compra, no formato `AAAA-MM-DD`      |
| `valor_compra` | REAL    | não         | Valor pago na compra (número decimal)        |

---

## 🔌 Endpoints da API

Base URL: `http://localhost:3000/api/itens`

| Método | Rota               | Descrição                                  |
|--------|--------------------|---------------------------------------------|
| GET    | `/api/itens`       | Lista todos os itens (aceita `?nome=` para pesquisa) |
| GET    | `/api/itens/estatisticas/resumo` | Retorna os indicadores do dashboard e do resumo do inventário |
| GET    | `/api/itens/:id`   | Retorna um item específico pelo ID          |
| POST   | `/api/itens`       | Cadastra um novo item                       |
| PUT    | `/api/itens/:id`   | Atualiza um item existente                  |
| DELETE | `/api/itens/:id`   | Remove um item existente                    |

### Detalhamento

#### `GET /api/itens`
Retorna a lista completa de itens, ordenados do mais recente para o mais antigo.

**Parâmetro de query opcional:**
- `nome` — filtra os itens cujo nome contenha o texto informado (case-insensitive, busca parcial). Usado pela pesquisa dinâmica do front-end.

Exemplo: `GET /api/itens?nome=notebook`

#### `GET /api/itens/estatisticas/resumo`
Retorna os indicadores calculados a partir de todos os itens cadastrados, usados no dashboard superior e na seção "Resumo do inventário":

```json
{
  "total_itens": 4,
  "valor_total": 11390.40,
  "valor_medio": 2847.60,
  "total_marcas": 4,
  "local_top": "Escritório",
  "local_top_quantidade": 2,
  "item_mais_caro": {
    "id": 4,
    "nome": "Geladeira",
    "local": "Cozinha",
    "marca": "Brastemp",
    "data_compra": "2021-06-05",
    "valor_compra": 4200.50
  }
}
```

#### `GET /api/itens/:id`
Retorna os dados de um único item.
- `404` se o item não existir.

#### `POST /api/itens`
Cadastra um novo item. Corpo da requisição em JSON:

```json
{
  "nome": "Notebook Dell Inspiron",
  "local": "Escritório",
  "descricao": "Notebook usado para estudos e trabalho",
  "marca": "Dell",
  "data_compra": "2024-03-15",
  "valor_compra": 3500.90
}
```

- Apenas `nome` é obrigatório; os demais campos são opcionais.
- Retorna `201 Created` com o item criado (incluindo o `id` gerado).
- Retorna `400 Bad Request` com a lista de erros de validação, caso os dados sejam inválidos.

#### `PUT /api/itens/:id`
Atualiza **todos os campos** de um item existente. Mesmo formato de corpo do `POST`.
- Retorna `200 OK` com o item atualizado.
- Retorna `404 Not Found` se o item não existir.
- Retorna `400 Bad Request` se os dados forem inválidos.

#### `DELETE /api/itens/:id`
Remove um item do banco de dados.
- Retorna `200 OK` com uma mensagem de confirmação.
- Retorna `404 Not Found` se o item não existir.

---

## 💡 Exemplos de uso

### Usando o `curl`

**Criar um item:**
```bash
curl -X POST http://localhost:3000/api/itens \
  -H "Content-Type: application/json" \
  -d '{"nome":"Smart TV LG 50\"","local":"Sala","marca":"LG","data_compra":"2023-11-20","valor_compra":2799.00}'
```

**Listar todos os itens:**
```bash
curl http://localhost:3000/api/itens
```

**Pesquisar itens pelo nome:**
```bash
curl "http://localhost:3000/api/itens?nome=tv"
```

**Buscar um item específico (ID 1):**
```bash
curl http://localhost:3000/api/itens/1
```

**Atualizar um item (ID 1):**
```bash
curl -X PUT http://localhost:3000/api/itens/1 \
  -H "Content-Type: application/json" \
  -d '{"nome":"Smart TV LG 55\"","local":"Sala","marca":"LG","data_compra":"2023-11-20","valor_compra":3199.00}'
```

**Excluir um item (ID 1):**
```bash
curl -X DELETE http://localhost:3000/api/itens/1
```

### Usando a interface web

1. Acesse `http://localhost:3000`.
2. Preencha o formulário **"Ficha do item"** com nome, local, descrição, marca, data e valor da compra.
3. Clique em **"Cadastrar item"** — o item aparecerá imediatamente na tabela à direita.
4. Use o campo **"Pesquisar por nome"** para filtrar a lista em tempo real.
5. Clique em **"Editar"** na linha de um item para carregar seus dados no formulário e alterá-los; clique em **"Salvar alterações"** para confirmar.
6. Clique em **"Excluir"** para remover um item — uma janela de confirmação será exibida antes da exclusão definitiva.

---

## 🔒 Segurança

O projeto implementa proteções básicas contra **XSS (Cross-Site Scripting)** e validação de dados:

- **Nenhum uso de `innerHTML`** para exibir dados vindos do usuário ou da API. Toda a renderização da tabela (`frontend/js/app.js`) é feita criando elementos com `document.createElement()` e atribuindo texto com `textContent`, que nunca interpreta HTML/JavaScript.
- **Validação no backend** (`backend/controllers/itensController.js`): o campo `nome` é obrigatório; `data_compra` deve seguir o formato `AAAA-MM-DD`; `valor_compra` deve ser numérico e não-negativo; limites de tamanho são aplicados aos campos de texto.
- **Sanitização de entradas no backend**: todos os campos de texto recebidos passam por uma função que remove tags HTML (`<...>`) antes de serem persistidos no banco — uma camada extra de defesa (*defense in depth*), mesmo que o front-end já proteja a exibição.
- **Uso de consultas parametrizadas (prepared statements)** em todas as operações SQL (`?` como placeholder), o que evita **injeção de SQL (SQL Injection)**.
- **Confirmação obrigatória antes de excluir**: a exclusão de um item só ocorre após o usuário confirmar a ação em uma janela modal.

---

## 🖥 Funcionalidades do frontend

- **Dashboard de indicadores** no topo da página, com 4 cartões: total de itens, valor total do patrimônio, quantidade de marcas diferentes e local com mais itens. Atualizado automaticamente após cadastrar, editar ou excluir qualquer item.
- **Cadastro de itens** através de um formulário com validação de campos e mensagens de erro por campo.
- **Listagem em tabela** exibindo ID, nome, local, marca, data e valor da compra.
- **Ordenação da tabela**: clique nos cabeçalhos "Nome", "Marca", "Data da compra" ou "Valor" para ordenar crescente/decrescente (clique novamente para alternar a direção).
- **Pesquisa dinâmica por nome**, com ícone de busca, campo maior e atualização automática da lista conforme o usuário digita (debounce de 300ms). Exibe a mensagem "Nenhum item encontrado para esta pesquisa." quando a busca não retorna resultados.
- **Edição de itens em modal**: ao clicar em "Editar", um modal centralizado é aberto já preenchido com os dados do item, sem recarregar ou redirecionar a página.
- **Exclusão de itens** com modal de confirmação ("Tem certeza que deseja excluir este item?"), com botões Cancelar/Excluir, evitando exclusões acidentais.
- **Notificações (toasts)** elegantes para cadastro, edição e exclusão, que desaparecem automaticamente após alguns segundos.
- **Resumo do inventário**, seção abaixo da tabela com quantidade total de itens, valor total do patrimônio, valor médio por item e o item mais caro cadastrado — todos calculados no backend a partir do banco de dados.
- **Validações no frontend**: nome obrigatório (e não apenas espaços em branco), valor maior que zero quando informado, e data válida — com mensagens amigáveis e destaque visual nos campos com erro. A validação definitiva, por segurança, é sempre repetida no backend.
- **Layout responsivo**, adaptado para celulares, tablets e monitores grandes. Em telas estreitas, o formulário e a tabela se empilham verticalmente.
- **Acessibilidade**: uso de `label`, `aria-live`, `role="alertdialog"`/`role="dialog"` nos modais, cabeçalhos de ordenação navegáveis por teclado (Enter/Espaço) e foco visível em elementos interativos.

---

## 🧩 Possíveis problemas e soluções

**Erro ao instalar o `sqlite3` (falha de compilação nativa):**
O pacote `sqlite3` compila um binário nativo na instalação. Se ocorrer erro:
- Certifique-se de ter o Node.js em uma versão LTS (16, 18 ou 20).
- Em sistemas Linux, pode ser necessário instalar ferramentas de build: `sudo apt-get install build-essential python3`.
- Como alternativa, é possível substituir o pacote `sqlite3` por `better-sqlite3` (ajustando as chamadas em `database.js` e `itensController.js` para a API síncrona dessa biblioteca).

**Porta 3000 já está em uso:**
Inicie o servidor em outra porta: `PORT=3001 npm start` (Linux/Mac) ou `set PORT=3001 && npm start` (Windows).

**A tabela aparece vazia mesmo após cadastrar itens:**
Verifique no terminal se o servidor exibiu alguma mensagem de erro ao salvar. Confira também se o arquivo `backend/database.db` foi criado com permissão de escrita na pasta.

---

## 📄 Licença

Projeto de uso acadêmico, livre para fins educacionais.
IA's utilizadas: Gemini e Claude
