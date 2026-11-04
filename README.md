# Atleta Eternus FC

Gerenciador de alimentação e treinos para atleta de futsal, rodando 100% no navegador.
HTML, CSS e JavaScript puros — sem build, sem framework, sem servidor. Os dados ficam no
**IndexedDB** do navegador e podem ser exportados/importados em **JSON**.

Este projeto é a reescrita web do app desktop original em Python/Tkinter (`atleta.py`).

---

## Sumário

1. [Como usar](#como-usar)
2. [Funcionalidades](#funcionalidades)
3. [Estrutura do projeto](#estrutura-do-projeto)
4. [Arquitetura](#arquitetura)
5. [Banco de dados (IndexedDB)](#banco-de-dados-indexeddb)
6. [Backup: exportar e importar JSON](#backup-exportar-e-importar-json)
7. [Cálculos](#cálculos)
8. [Responsividade](#responsividade)
9. [Como estender](#como-estender)
10. [Limitações e dicas](#limitações-e-dicas)

---

## Como usar

1. Extraia a pasta do projeto.
2. Abra o `index.html` em um navegador moderno (Chrome, Edge, Firefox, Safari).
3. Na primeira abertura você cai na tela **Perfil**: preencha e salve para liberar as metas.

Não precisa de servidor. Se preferir servir por HTTP (por exemplo, para acessar do celular
na mesma rede):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

**Logo (opcional):** coloque um arquivo `Logo.png` em `imagens/`. Sem ele, aparece o selo "OLP".

**Requisitos:** navegador com suporte a IndexedDB e `<input type="date">`. Não funciona em
janela anônima de alguns navegadores (o armazenamento é bloqueado ou descartado ao fechar).

---

## Funcionalidades

| Tela | O que faz |
|---|---|
| **📊 Painel** | Saudação, meta do dia, consumido, restante e gasto estimado; macros do dia; treino planejado e realizado; tarefas concluídas; gráfico interativo de peso. |
| **✅ Tarefas do dia** | Lista diária por data, com categorias, tarefas fixas ("repetir todo dia"), edição, apagar, trazer pendências de ontem e barra de progresso. Duplo clique conclui/reabre. |
| **🍽 Alimentação** | Lança alimentos por refeição e data com preenchimento automático dos macros (por gramas), salva alimentos novos, usa e cria **refeições modelo**, mostra resumo e balanço calórico do dia. |
| **🏋 Treinos** | Quatro abas: **Academia** (séries, reps, carga), **Cardio** (contínuo ou HIIT, com pace), **Futsal** (treinos e jogos com placar, gols e assistências) e **Mobilidade** (método e regiões). Permite informar kcal manualmente ou estimar por MET. |
| **📅 Rotina semanal** | Planejamento de treinos por dia da semana, com horário. O planejado aparece no Painel e em Treinos ("Preencher registro com o planejado"). |
| **🥗 Meus alimentos** | Cadastro/edição de alimentos (valores por 100 g) com busca; criação de refeições modelo com itens e totais. |
| **📈 Evolução** | Progressão de carga por exercício (gráfico, volume e 1RM estimado), pace por modalidade de cardio, estatísticas de jogos de futsal e resumo de mobilidade. |
| **👤 Perfil** | Dados pessoais, objetivo, nível de atividade, resultado do cálculo energético, registro de peso e botão para apagar todos os dados. |

Menu lateral (rodapé): **Exportar dados (JSON)** e **Importar dados (JSON)**.

---

## Estrutura do projeto

```
atleta-web/
├── index.html              # casca da aplicação (menu, container, scripts)
├── css/
│   └── style.css           # tema escuro + layout responsivo
├── imagens/
│   └── Logo.png            # opcional
└── js/
    ├── util.js             # constantes, datas, números, energia, componentes de UI
    ├── db.js               # camada de dados (IndexedDB) + exportar/importar
    ├── chart.js            # gráfico de linha interativo (tooltip, período, zoom)
    ├── app.js              # núcleo: helpers compartilhados, navegação, backup, init
    └── pages/
        ├── dashboard.js    # Painel
        ├── todo.js         # Tarefas do dia
        ├── food.js         # Alimentação
        ├── train.js        # Treinos
        ├── routine.js      # Rotina semanal
        ├── pantry.js       # Meus alimentos e refeições modelo
        ├── progress.js     # Evolução
        └── profile.js      # Perfil
```

A ordem dos `<script>` no `index.html` importa: `util.js` → `db.js` → páginas → `app.js`.
Os scripts são clássicos (não módulos ES) justamente para funcionar abrindo o arquivo
direto do disco (`file://`).

---

## Arquitetura

### Camadas

```
 pages/*.js  ──►  app.js (App)  ──►  db.js (DB)  ──►  IndexedDB
      │                                   ▲
      └────────────  util.js  ────────────┘   (constantes, cálculos, UI)
```

- **`db.js`** é a **única** parte que toca no IndexedDB. As páginas só chamam métodos de `DB`.
- **`util.js`** não depende de nada: constantes de domínio, funções puras (datas, `num`,
  `energy`) e componentes de interface.
- **`app.js`** expõe o objeto global `App` com helpers usados por várias telas
  (`weight`, `planned`, `planText`, `eatKcal`, `dayTotals`, `ensureDailyTodos`) e cuida da
  navegação e do backup.
- **Páginas** são fábricas registradas em `Pages.<chave>`. Cada uma recebe `app` e devolve
  `{ el, refresh }`.

### Ciclo de vida de uma página

1. No `init`, o `App` chama `Pages[chave](App)` para cada tela e anexa `el` ao `#content`.
2. A estrutura HTML é montada **uma vez** (assim campos digitados e séries em andamento não se perdem ao navegar).
3. Ao abrir a tela, `App.show(chave)` esconde as demais e chama `refresh()`, que lê o banco e atualiza apenas as partes dinâmicas.

### Componentes de UI (`util.js`)

| Função | Uso |
|---|---|
| `pageShell(titulo, subtitulo)` | Cabeçalho + corpo padrão de página |
| `fld`, `inp`, `sel`, `btn` | Geram HTML de campo, input, select e botão (`data-act="acao"`) |
| `bindActions(raiz, {acao: fn})` | Delegação de cliques por `data-act` |
| `dayNav(onChange)` | Seletor de data ◀ ▶ Hoje |
| `mkTable(colunas, opts)` | Tabela com seleção de linha (`set`, `selected`, `select`) |
| `mkTabs([[rotulo, elemento]])` | Abas |
| `setBar(i, valor, max, excedeu)` | Barra de progresso |
| `mkChart(opts)` (`chart.js`) | Gráfico de linha interativo em SVG — ver [Gráficos](#gráficos-interativos) |
| `toast(msg)` / `info(msg)` | Aviso discreto / alerta |
| `esc(texto)` | Escapa HTML — **use sempre em texto digitado pelo usuário** |

---

## Banco de dados (IndexedDB)

Nome do banco: `atleta-eternus-fc` · versão do schema: `1`.

| Store | Chave | Índices | Campos |
|---|---|---|---|
| `profile` | `id` (sempre `1`) | — | name, position, sex, birth (ISO), height, weight, bodyfat, neat, goal |
| `weight_log` | `date` | — | weight |
| `foods` | `id` (auto) | `name` (único) | name, kcal, prot, carb, fat — **por 100 g** |
| `meals` | `id` (auto) | `date` | date, meal, food, qty, kcal, prot, carb, fat |
| `workouts` | `id` (auto) | `date` | date, kind, title, duration, rpe, kcal, notes |
| `gym_sets` | `id` (auto) | `workout_id`, `exercise` | workout_id, exercise, set_no, reps, load |
| `cardio` | `workout_id` | `modality` | modality, mode, distance, pace, rounds, work_s, rest_s |
| `football` | `workout_id` | — | focus, opponent, result, minutes, goals, assists |
| `mobility` | `workout_id` | — | method, areas |
| `routine` | `id` (auto) | `weekday` | weekday (0 = segunda), time, kind, title, detail |
| `meal_templates` | `id` (auto) | `name` (único) | name, meal |
| `template_items` | `id` (auto) | `template_id` | template_id, food, qty, kcal, prot, carb, fat |
| `todos` | `id` (auto) | `date` | date, text, category, done (0/1) |
| `todo_daily` | `id` (auto) | — | text, category |
| `todo_generated` | `date` | — | (marca dias que já receberam as tarefas fixas) |
| `meta` | `key` | — | flags internas (ex.: `seeded`). **Não é exportada.** |

Datas são sempre strings ISO locais `AAAA-MM-DD` (nunca UTC).

### API de `DB`

Genéricas: `all(store)`, `get(store, chave)`, `put`, `add`, `del`, `where(store, indice, valor)`,
`between(store, indice, min, max)`, `count(store)`.

De domínio (operações com várias stores em **uma única transação**):

- `getProfile()`, `saveProfile(p)` — grava o perfil e o peso do dia.
- `logWeight(iso, peso)` — grava no histórico e atualiza o perfil.
- `upsertFood(f)` — insere ou atualiza alimento pelo nome (nome é único).
- `saveWorkout(treino, extras)` — grava o treino e seus detalhes (`gym_sets`, `cardio`, `football`, `mobility`) de forma atômica.
- `deleteWorkout(id)` — remove o treino e seus detalhes (exclusão em cascata manual).
- `createTemplate(nome, refeicao, itens)` / `deleteTemplate(id)` — modelos com seus itens.
- `exportAll()`, `inspectBackup(obj)`, `importAll(obj)`, `resetAll()`, `seed()`.

O IndexedDB não tem chave estrangeira nem cascata; por isso as exclusões em cascata são
feitas em `db.js`. Sempre apague treinos e modelos por `deleteWorkout` / `deleteTemplate`.

### Dados iniciais

Na primeira execução (e se não houver nenhum alimento), 20 alimentos comuns são cadastrados
(arroz, feijão, frango, ovo, aveia, whey etc.), com valores aproximados por 100 g.

---

## Backup: exportar e importar JSON

### Exportar

Botão **⬇ Exportar dados (JSON)** → baixa `atleta-eternus-backup-AAAA-MM-DD.json`.

Formato:

```json
{
  "format": "atleta-eternus-fc-backup",
  "version": 1,
  "app": "Atleta Eternus FC",
  "exportedAt": "2026-11-04T21:30:00.000Z",
  "stores": {
    "profile": [ { "id": 1, "name": "…", "birth": "1998-05-10", "…": "…" } ],
    "foods":   [ { "id": 1, "name": "Arroz branco cozido", "kcal": 128, "…": "…" } ],
    "workouts": [],
    "…": []
  }
}
```

Cada chave de `stores` é uma das stores da tabela acima (exceto `meta`), com todas as linhas.
Os `id`s são preservados, então os vínculos (`workout_id`, `template_id`) continuam válidos.

### Importar

Botão **⬆ Importar dados (JSON)**:

1. O arquivo é lido e **validado** (`format`, `version`, estrutura das stores). Arquivos que não são backup do app são recusados com mensagem clara.
2. Um resumo é exibido (nº de refeições, treinos, alimentos, tarefas e pesos) e é pedida **confirmação**.
3. A importação **substitui todos os dados atuais**, em uma única transação — se algo falhar, nada é alterado.

> Faça uma exportação antes de importar se quiser manter os dados atuais.

Dica: o backup é um JSON legível; pode ser versionado, editado à mão ou usado para migrar de
navegador/dispositivo.

---

## Cálculos

**TMB** (taxa metabólica basal)
- Com % de gordura informado: **Katch-McArdle** — `370 + 21,6 × massa magra (kg)`.
- Sem: **Mifflin-St Jeor** — `10×peso + 6,25×altura − 5×idade + 5` (homem) ou `− 161` (mulher).

**Gasto total (TDEE)** = `TMB + NEAT + EAT + TEF`
- **NEAT:** % da TMB conforme o nível de atividade fora do treino (10 % / 20 % / 30 % / 40 %).
- **EAT:** soma das kcal dos treinos do dia (mobilidade não conta).
- **TEF:** 10 % de `TMB + NEAT + EAT`.

**Meta calórica** = `TDEE × (1 + ajuste do objetivo)` — manter (0), cutting leve (−10 %),
cutting (−20 %), bulking leve (+10 %), bulking (+15 %).

**Macros sugeridos:** proteína 2 g/kg, gordura 0,9 g/kg, carboidrato = restante das calorias.

**kcal estimadas dos treinos** (usadas quando o campo "Calorias gastas" fica vazio):
`kcal = MET × peso (kg) × horas`

| Treino | MET |
|---|---|
| Academia | 5,0 |
| Cardio HIIT | 10,0 |
| Corrida / Esteira | `max(6, velocidade km/h)` |
| Bike / Natação / Caminhada / Elíptico | 7,5 / 7,0 / 3,8 / 5,0 |
| Futsal: técnico, fundamentos, tático, bola parada, outro | 5,0 / 6,0 / 6,0 / 5,0 / 5,0 |
| Futsal: coletivo, físico | 8,5 |
| Futsal: jogo | 10,0 (usa os minutos jogados) |

**Evolução de carga:** 1RM estimado pela fórmula de Epley, `carga × (1 + reps/30)`; volume = `Σ reps × carga`.

Os valores são estimativas para acompanhamento, não prescrição médica ou nutricional.

---

## Gráficos interativos

Os gráficos de peso (Painel), carga por exercício e pace (Evolução) usam `mkChart` (`js/chart.js`):

| Recurso | Como usar |
|---|---|
| **Tooltip** | Passe o mouse ou toque no gráfico: mostra data, valor, variação em relação ao ponto anterior e um detalhe extra (ex.: reps, 1RM, distância). |
| **Período** | Botões **7 dias / 30 dias / 90 dias / Tudo** (peso abre em 30 dias; os demais em "Tudo"). |
| **Zoom** | Roda do mouse (no ponto do cursor), botões **− / + / Reset** ou pinça no celular. |
| **Mover** | Arraste o gráfico (mouse ou dedo) quando estiver com zoom. |
| **Resetar** | Duplo clique ou botão **Reset**. |

O eixo X é proporcional ao tempo (dias sem registro aparecem como intervalos) e o eixo Y
se ajusta aos valores visíveis. Uso:

```js
const ch = mkChart({ name: 'Peso', color: '#E04F74', period: 30,
                     fmt: v => v.toFixed(1) + ' kg', fmtDelta: d => (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) });
container.appendChild(ch.el);
ch.set([['2026-11-01', 75.2], ['2026-11-02', 75.0, 'detalhe opcional']]);   // [dataISO, valor, extra]
```

Opções: `name`, `color`, `fmt` (valor no tooltip), `axisFmt` (eixo), `fmtDelta`, `height`, `period`, `periods`.

---

## Responsividade

- **Desktop (> 980 px):** barra lateral fixa e layouts em duas colunas.
- **Tablet/celular (≤ 980 px):** a barra lateral vira uma **gaveta** (botão ☰ no topo; fecha ao tocar fora ou ao navegar); colunas empilham; a grade da rotina ajusta o número de colunas.
- **Celular (≤ 600 px):** campos ocupam a largura disponível, fonte 16 px nos inputs (evita zoom no iOS), botões maiores, tabelas e abas com rolagem horizontal interna.

---

## Como estender

### Adicionar uma nova página

1. Crie `js/pages/minha.js`:

```js
'use strict';
window.Pages = window.Pages || {};
Pages.minha = app => {
  const s = pageShell('Minha página', 'Subtítulo');
  s.body.innerHTML = `<div class="card pad">…</div>`;
  bindActions(s.body, { salvar: async () => { /* usa DB.* */ } });
  async function refresh() { /* lê do DB e atualiza a tela */ }
  return { el: s.el, refresh };
};
```

2. Inclua o `<script src="js/pages/minha.js">` no `index.html` (antes de `app.js`).
3. Registre em `app.js`, na lista `items` do `init`: `['minha', '⭐  Minha página']`.

### Adicionar uma store ou índice

1. Declare em `SCHEMA` (`db.js`) e **aumente `VERSION`** — o `onupgradeneeded` cria o que faltar sem apagar o que já existe.
2. Se a store guarda dados do usuário, ela entra automaticamente no export/import.
3. Se tiver relação com outra store, implemente a exclusão em cascata em `db.js`.

### Mudar o tema

As cores estão em variáveis CSS no `:root` de `css/style.css` (`--accent`, `--accent2`, `--bg`, `--card` …).

---

## Limitações e dicas

- **Os dados são locais** ao navegador e ao perfil em que o app foi aberto. Limpar os dados do site ou trocar de navegador/dispositivo apaga ou isola as informações — **exporte backups com frequência**.
- O app pede armazenamento persistente (`navigator.storage.persist()`), mas o navegador pode recusar.
- Abrir via `file://` e via `http://localhost` usam **bancos diferentes** (origens diferentes). Para levar os dados de um para o outro, use exportar/importar.
- A importação é "substituir tudo"; não há mesclagem.
- Mobilidade não entra no gasto calórico.
- Não há sincronização entre dispositivos; use o JSON para transferir.
