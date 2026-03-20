# Pioli DB - MCP Server

Servidor MCP (Model Context Protocol) para integrar o banco de dados Pioli com chatbots e assistentes de IA.

## Instalacao

```bash
cd mcp
npm install
```

## Configuracao

Variaveis de ambiente:

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| `PIOLI_API_URL` | URL base da API do Pioli DB | `https://pioli.talkhub.me` |
| `PIOLI_API_KEY` | Chave de API para autenticacao | (vazio = sem auth) |

## Uso com Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pioli-db": {
      "command": "node",
      "args": ["/caminho/para/mcp/server.js"],
      "env": {
        "PIOLI_API_URL": "https://pioli.talkhub.me",
        "PIOLI_API_KEY": "sua_chave_aqui"
      }
    }
  }
}
```

## Tools Disponiveis

| Tool | Descricao |
|------|-----------|
| `search_records` | Buscar registros com filtros e busca por texto |
| `get_record` | Buscar registro por ID |
| `create_record` | Criar novo registro |
| `update_record` | Atualizar registro existente |
| `delete_record` | Deletar registro |
| `list_tables` | Listar tabelas disponiveis |
| `get_table_columns` | Ver colunas de uma tabela |
| `get_stats` | Estatisticas do banco |

## Exemplos de uso pelo chatbot

- "Busque todos os planos ativos em Rio Claro"
- "Qual o email do cliente com codigo 56?"
- "Atualize o telefone do registro 123"
- "Quantos registros temos no total?"
