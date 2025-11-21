# 🚀 Webhook Forwarding para Spring Boot

## Visão Geral

O webhook monitor agora **encaminha automaticamente** todos os eventos recebidos para a aplicação Spring Boot, permitindo:

- ✅ **Visualização em tempo real** no monitor web
- ✅ **Persistência no banco de dados** via Spring Boot
- ✅ **Retry automático** em caso de falhas
- ✅ **Logs detalhados** de todos os encaminhamentos
- ✅ **Estatísticas de sucesso/falha**

---

## Configuração

### Variáveis de Ambiente

```bash
# URL do endpoint Spring Boot
SPRING_BOOT_URL=http://localhost:8080/api/webhook/evolution

# Habilitar/desabilitar encaminhamento
FORWARD_ENABLED=true

# Timeout em milissegundos
FORWARD_TIMEOUT=5000

# Número de tentativas em caso de falha
FORWARD_RETRY_ATTEMPTS=3
```

### Configuração Padrão (Sem Variáveis de Ambiente)

Se você não definir variáveis de ambiente, os valores padrão são:

- `SPRING_BOOT_URL`: `http://localhost:8080/api/webhook/evolution`
- `FORWARD_ENABLED`: `true`
- `FORWARD_TIMEOUT`: `5000` ms
- `FORWARD_RETRY_ATTEMPTS`: `3` tentativas

---

## Como Usar

### 1. Iniciar Spring Boot

```bash
cd C:\Users\jhonnyscerni\Documents\workspace\workspace-wpp
./mvnw spring-boot:run
```

A aplicação Spring Boot deve estar rodando em `http://localhost:8080`

### 2. Iniciar Webhook Monitor

```bash
cd C:\Users\jhonnyscerni\Documents\workspace\webhook
npm start
```

O monitor rodará em `http://localhost:3000`

### 3. Verificar Conectividade

```bash
# Health check do monitor
curl http://localhost:3000/api/health

# Deve retornar:
{
  "monitor": {
    "status": "UP",
    "forwardingEnabled": true,
    "messagesStored": 0
  },
  "status": "UP",
  "springBoot": {
    "reachable": true,
    "status": 200,
    "url": "http://localhost:8080/api/webhook/health"
  }
}
```

### 4. Testar Encaminhamento

Envie uma mensagem no WhatsApp ou faça um POST manual:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "MESSAGES_UPSERT",
    "instance": "jhonnyscerni",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "TEST123"
      },
      "message": {
        "conversation": "Mensagem de teste"
      }
    }
  }'
```

### 5. Verificar Logs

**Monitor (Terminal 1)**:
```
🚀 [2025-11-21T18:00:00.000Z] Encaminhando evento para Spring Boot (Tentativa 1/3)
   Evento: MESSAGES_UPSERT
   URL: http://localhost:8080/api/webhook/evolution
✅ [2025-11-21T18:00:00.123Z] Encaminhamento bem-sucedido!
   Status: 200
   Taxa de sucesso: 100.00%
```

**Spring Boot (Terminal 2)**:
```
=== WEBHOOK RECEIVED ===
Event Type: MESSAGES_UPSERT
Instance: jhonnyscerni
Data: {key={remoteJid=5511999999999@s.whatsapp.net, ...
Processing webhook event: MESSAGES_UPSERT for instance: jhonnyscerni
Webhook processed successfully
```

---

## Endpoints Novos

### GET /api/health

Verifica saúde do monitor e conectividade com Spring Boot.

**Resposta (Spring Boot UP)**:
```json
{
  "monitor": {
    "status": "UP",
    "forwardingEnabled": true,
    "messagesStored": 5
  },
  "status": "UP",
  "springBoot": {
    "reachable": true,
    "status": 200,
    "url": "http://localhost:8080/api/webhook/health"
  }
}
```

**Resposta (Spring Boot DOWN)**:
```json
{
  "monitor": {
    "status": "UP",
    "forwardingEnabled": true,
    "messagesStored": 5
  },
  "status": "DOWN",
  "springBoot": {
    "reachable": false,
    "error": "Spring Boot offline",
    "url": "http://localhost:8080/api/webhook/evolution"
  }
}
```

### GET /api/forward-stats

Retorna estatísticas detalhadas de encaminhamento.

**Resposta**:
```json
{
  "enabled": true,
  "springBootUrl": "http://localhost:8080/api/webhook/evolution",
  "timeout": 5000,
  "retryAttempts": 3,
  "stats": {
    "total": 25,
    "success": 23,
    "failed": 2,
    "lastSuccess": "2025-11-21T18:05:00.123Z",
    "lastFailure": "2025-11-21T17:30:00.456Z",
    "lastError": "Timeout - Spring Boot não respondeu a tempo",
    "successRate": "92.00%",
    "failureRate": "8.00%"
  }
}
```

---

## Comportamento de Retry

Quando o encaminhamento falha, o sistema tenta novamente automaticamente:

### Tentativas com Exponential Backoff

- **Tentativa 1**: Imediata
- **Tentativa 2**: Aguarda 1 segundo
- **Tentativa 3**: Aguarda 2 segundos

### Logs de Retry

```
🚀 [2025-11-21T18:00:00.000Z] Encaminhando evento para Spring Boot (Tentativa 1/3)
❌ [2025-11-21T18:00:00.100Z] Falha no encaminhamento (Tentativa 1/3)
   Erro: Conexão recusada - Spring Boot pode estar offline
⏳ Aguardando 1000ms antes de tentar novamente...

🚀 [2025-11-21T18:00:01.100Z] Encaminhando evento para Spring Boot (Tentativa 2/3)
✅ [2025-11-21T18:00:01.250Z] Encaminhamento bem-sucedido!
   Status: 200
   Taxa de sucesso: 100.00%
```

### Falha Total

Se todas as tentativas falharem:

```
💥 [2025-11-21T18:00:03.500Z] Todas as tentativas de encaminhamento falharam!
   Taxa de falha: 4.00%
```

**Importante**: O evento continua armazenado no monitor e visível na interface web, mesmo se o encaminhamento falhar.

---

## Desabilitar Encaminhamento

### Opção 1: Variável de Ambiente

```bash
FORWARD_ENABLED=false npm start
```

### Opção 2: Modificar Código

Edite `index.js` linha 13:
```javascript
const FORWARD_ENABLED = false;
```

### Logs Quando Desabilitado

```
⚠️  Encaminhamento desabilitado via configuração
```

---

## Troubleshooting

### Problema: Spring Boot não recebe eventos

**Verificar**:
1. Spring Boot está rodando? `curl http://localhost:8080/api/webhook/health`
2. URL está correta? Verificar `SPRING_BOOT_URL`
3. Firewall bloqueando? Testar com `curl` manualmente
4. Verificar logs do monitor para erros

### Problema: Erro "ECONNREFUSED"

**Causa**: Spring Boot não está rodando ou não está acessível.

**Solução**:
```bash
# Iniciar Spring Boot
cd C:\Users\jhonnyscerni\Documents\workspace\workspace-wpp
./mvnw spring-boot:run
```

### Problema: Timeout

**Causa**: Spring Boot está respondendo lentamente ou processamento demorado.

**Solução**: Aumentar timeout
```bash
FORWARD_TIMEOUT=10000 npm start
```

### Problema: Taxa de falha alta

**Verificar**:
1. Estabilidade da rede entre monitor e Spring Boot
2. Capacidade do Spring Boot (verificar logs de erro)
3. Configuração do banco de dados PostgreSQL
4. Usar `/api/forward-stats` para análise detalhada

---

## Fluxo de Dados Completo

```
1. WhatsApp → Evolution API
                ↓
2. Evolution API → POST /webhook (Monitor Node.js)
                    ↓
                    ├─→ Armazena in-memory (visualização web) ✅
                    └─→ Encaminha para Spring Boot ✅
                         ↓
3. Spring Boot → Processa evento
                  ↓
4. PostgreSQL → Persiste mensagem ✅
```

---

## Estrutura de Evento Encaminhado

O monitor encaminha o evento **exatamente como recebeu** do Evolution API:

```json
{
  "event": "MESSAGES_UPSERT",
  "instance": "jhonnyscerni",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0...",
      "participant": null
    },
    "message": {
      "conversation": "Olá, tudo bem?",
      "messageTimestamp": "1700000000"
    },
    "messageType": "conversation",
    "messageTimestamp": 1700000000,
    "pushName": "João Silva",
    "status": "SERVER_ACK"
  },
  "destination": "jhonnyscerni",
  "date_time": "2025-11-21T18:00:00.000Z",
  "server_url": "https://evolution-evolution-api.lupjqq.easypanel.host",
  "apikey": "***"
}
```

---

## Próximos Passos

1. ✅ Iniciar Spring Boot
2. ✅ Iniciar Monitor com encaminhamento habilitado
3. ✅ Verificar `/api/health`
4. ✅ Enviar mensagem de teste no WhatsApp
5. ✅ Verificar logs de ambas aplicações
6. ✅ Verificar banco de dados PostgreSQL
7. ✅ Monitorar `/api/forward-stats` periodicamente

---

## Benefícios da Arquitetura

### Visualização + Persistência
- Monitor: Debugging visual em tempo real
- Spring Boot: Armazenamento permanente no PostgreSQL

### Resiliência
- Retry automático aumenta confiabilidade
- Eventos não se perdem se Spring Boot estiver temporariamente offline

### Observabilidade
- Logs detalhados em ambos os lados
- Estatísticas de sucesso/falha
- Health checks automatizados

### Flexibilidade
- Encaminhamento pode ser ligado/desligado sem parar aplicação
- Configurável via variáveis de ambiente
- Não bloqueia resposta ao Evolution API
