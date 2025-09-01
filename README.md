# Dashboard de Monitoramento Multi-Setor

## Problema de Mixed Content (HTTPS/HTTP)

### O que está acontecendo:
O Vercel serve o site via HTTPS, mas a API está em HTTP. Os navegadores bloqueiam requisições HTTP de sites HTTPS por segurança.

### Soluções implementadas:

1. **Proxy do Vercel**: Criado `vercel.json` para fazer proxy da API
2. **Fallback automático**: Tenta múltiplas URLs em ordem de prioridade
3. **Indicador de erro**: Mostra status de conexão no header
4. **Logs detalhados**: Console mostra tentativas de conexão

### URLs tentadas (em ordem):
1. `/api/getlist` (proxy do Vercel)
2. `https://api.allorigins.win/raw?url=...` (CORS proxy público)
3. `https://147.182.191.150:4000/getlist` (HTTPS direto)
4. `http://147.182.191.150:4000/getlist` (HTTP fallback)

### Modo Demonstração:
- Se todas as URLs falharem, o sistema usa dados mockados
- Indicador visual: 🟡 "Modo Demonstração"
- Dados são gerados automaticamente para teste

### Para resolver definitivamente:

#### Opção 1: Configurar HTTPS na API
- Instalar certificado SSL no servidor da API
- Configurar para aceitar conexões HTTPS na porta 4000

#### Opção 2: Usar proxy do Vercel
- O arquivo `vercel.json` já está configurado
- Redeploy no Vercel para aplicar as configurações

#### Opção 3: Usar CORS proxy público
- Exemplo: `https://cors-anywhere.herokuapp.com/`
- Adicionar antes da URL da API

### Status visual:
- 🟢 Verde: Sistema Online (conectado)
- 🟡 Amarelo: Modo Demonstração (dados mockados)
- 🔴 Vermelho: Erro de Conexão (falha na API)

### Desenvolvimento local:
- Use `http://localhost` para desenvolvimento
- O sistema detecta automaticamente o ambiente
