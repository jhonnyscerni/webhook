const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

let messages = [];

// ========================================
// Configuração de Encaminhamento
// ========================================
const SPRING_BOOT_URL = process.env.SPRING_BOOT_URL || 'http://localhost:8080/api/webhook/evolution';
const FORWARD_ENABLED = process.env.FORWARD_ENABLED !== 'false';
const FORWARD_TIMEOUT = parseInt(process.env.FORWARD_TIMEOUT) || 5000;
const RETRY_ATTEMPTS = parseInt(process.env.FORWARD_RETRY_ATTEMPTS) || 3;
const RETRY_DELAY_BASE = 1000; // 1 segundo base para exponential backoff

// Estatísticas de encaminhamento
let forwardStats = {
    total: 0,
    success: 0,
    failed: 0,
    lastSuccess: null,
    lastFailure: null,
    lastError: null
};

console.log('🔧 Configuração de Encaminhamento:');
console.log(`  URL Spring Boot: ${SPRING_BOOT_URL}`);
console.log(`  Encaminhamento: ${FORWARD_ENABLED ? 'HABILITADO' : 'DESABILITADO'}`);
console.log(`  Timeout: ${FORWARD_TIMEOUT}ms`);
console.log(`  Tentativas de Retry: ${RETRY_ATTEMPTS}`);

// Função para formatar telefone
function formatPhone(jid) {
    if (!jid) return 'N/A';
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', ' (Grupo)');
}

// Função para obter o tipo de evento em português
function getEventLabel(event) {
    const labels = {
        'messages.upsert': '💬 Nova Mensagem',
        'messages.update': '✏️ Mensagem Atualizada',
        'messages.delete': '🗑️ Mensagem Deletada',
        'chats.upsert': '💭 Chat Atualizado',
        'chats.update': '💭 Chat Modificado',
        'connection.update': '🔌 Status Conexão',
        'qrcode.updated': '📱 QR Code',
        'send.message': '📤 Mensagem Enviada',
        'presence.update': '👀 Status Online',
        'contacts.update': '👤 Contato Atualizado'
    };
    return labels[event] || `📋 ${event}`;
}

// ========================================
// Função de Encaminhamento com Retry
// ========================================
async function forwardToSpringBoot(eventData, attempt = 1) {
    forwardStats.total++;

    const timestamp = new Date().toISOString();
    const eventType = eventData.event || 'unknown';

    console.log(`\n🚀 [${timestamp}] Encaminhando evento para Spring Boot (Tentativa ${attempt}/${RETRY_ATTEMPTS})`);
    console.log(`   Evento: ${eventType}`);
    console.log(`   URL: ${SPRING_BOOT_URL}`);

    try {
        const response = await axios.post(SPRING_BOOT_URL, eventData, {
            timeout: FORWARD_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Webhook-Monitor/1.0'
            }
        });

        forwardStats.success++;
        forwardStats.lastSuccess = timestamp;

        console.log(`✅ [${timestamp}] Encaminhamento bem-sucedido!`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Taxa de sucesso: ${((forwardStats.success / forwardStats.total) * 100).toFixed(2)}%`);

        return { success: true, attempt };

    } catch (error) {
        const errorMessage = error.response
            ? `HTTP ${error.response.status}: ${error.response.statusText}`
            : error.code === 'ECONNREFUSED'
            ? 'Conexão recusada - Spring Boot pode estar offline'
            : error.code === 'ETIMEDOUT'
            ? 'Timeout - Spring Boot não respondeu a tempo'
            : error.message;

        console.error(`❌ [${timestamp}] Falha no encaminhamento (Tentativa ${attempt}/${RETRY_ATTEMPTS})`);
        console.error(`   Erro: ${errorMessage}`);

        // Retry com exponential backoff
        if (attempt < RETRY_ATTEMPTS) {
            const delayMs = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
            console.log(`⏳ Aguardando ${delayMs}ms antes de tentar novamente...`);

            await new Promise(resolve => setTimeout(resolve, delayMs));
            return forwardToSpringBoot(eventData, attempt + 1);
        }

        // Todas as tentativas falharam
        forwardStats.failed++;
        forwardStats.lastFailure = timestamp;
        forwardStats.lastError = errorMessage;

        console.error(`💥 [${timestamp}] Todas as tentativas de encaminhamento falharam!`);
        console.error(`   Taxa de falha: ${((forwardStats.failed / forwardStats.total) * 100).toFixed(2)}%`);

        return { success: false, error: errorMessage, attempts: attempt };
    }
}

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webhook WhatsApp - Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container { max-width: 1400px; margin: 0 auto; }
        
        .header {
            background: white;
            padding: 20px 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 { color: #333; }
        
        .header-actions {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
        }
        
        .btn-refresh {
            background: #667eea;
            color: white;
        }
        
        .btn-refresh:hover { background: #5568d3; }
        
        .btn-clear {
            background: #ef4444;
            color: white;
        }
        
        .btn-clear:hover { background: #dc2626; }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .stat-card h3 {
            color: #666;
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .stat-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
        }
        
        .messages {
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            padding: 20px;
            max-height: 700px;
            overflow-y: auto;
        }
        
        .messages h2 {
            margin-bottom: 20px;
            color: #333;
        }
        
        .message-item {
            background: #f9fafb;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 8px;
            position: relative;
        }
        
        .message-item.received { border-left-color: #10b981; }
        .message-item.sent { border-left-color: #3b82f6; }
        .message-item.chat { border-left-color: #f59e0b; }
        .message-item.connection { border-left-color: #8b5cf6; }
        
        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .event-badge {
            display: inline-block;
            padding: 6px 12px;
            background: #667eea;
            color: white;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
        }
        
        .timestamp {
            color: #999;
            font-size: 12px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 12px;
            margin-bottom: 15px;
        }
        
        .info-item {
            background: white;
            padding: 12px;
            border-radius: 6px;
        }
        
        .info-label {
            font-size: 11px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        
        .info-value {
            font-size: 14px;
            color: #333;
            font-weight: 500;
            word-break: break-all;
        }
        
        .message-content {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            font-size: 14px;
            color: #333;
            line-height: 1.5;
        }
        
        .json-toggle {
            margin-top: 15px;
        }
        
        details {
            cursor: pointer;
        }
        
        summary {
            color: #667eea;
            font-size: 13px;
            font-weight: 500;
            padding: 8px 0;
        }
        
        .json-data {
            background: #1f2937;
            color: #10b981;
            padding: 15px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            margin-top: 10px;
        }
        
        .no-messages {
            text-align: center;
            padding: 60px 20px;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 Monitor de Webhooks WhatsApp</h1>
            <div class="header-actions">
                <button class="btn btn-refresh" onclick="location.reload()">🔄 Atualizar</button>
                <button class="btn btn-clear" onclick="clearMessages()">🗑️ Limpar</button>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>📊 Total de Eventos</h3>
                <div class="value">${messages.length}</div>
            </div>
            <div class="stat-card">
                <h3>💬 Mensagens</h3>
                <div class="value">${messages.filter(m => m.event?.includes('messages')).length}</div>
            </div>
            <div class="stat-card">
                <h3>💭 Chats</h3>
                <div class="value">${messages.filter(m => m.event?.includes('chats')).length}</div>
            </div>
            <div class="stat-card">
                <h3>⚡ Outros</h3>
                <div class="value">${messages.filter(m => !m.event?.includes('messages') && !m.event?.includes('chats')).length}</div>
            </div>
        </div>
        
        <div class="messages">
            <h2>Eventos Recebidos</h2>
            ${messages.length === 0 ? '<div class="no-messages">Aguardando eventos...</div>' : ''}
            ${messages.map((msg, index) => {
        const timestamp = new Date(msg.receivedAt).toLocaleString('pt-BR');
        const eventLabel = getEventLabel(msg.event);

        // Extrair informações
        const remoteJid = msg.data?.key?.remoteJid || msg.data?.[0]?.remoteJid || msg.data?.remoteJid;
        const from = formatPhone(remoteJid);
        const sender = formatPhone(msg.sender);
        const isFromMe = msg.data?.key?.fromMe;
        const unreadCount = msg.data?.[0]?.unreadMessages;

        // Extrair mensagem
        const message = msg.data?.message?.conversation ||
            msg.data?.message?.extendedTextMessage?.text ||
            msg.data?.pushName ||
            null;

        // Classe CSS baseada no tipo
        let cssClass = 'message-item';
        if (msg.event?.includes('messages') && isFromMe === false) cssClass += ' received';
        else if (msg.event?.includes('messages') && isFromMe === true) cssClass += ' sent';
        else if (msg.event?.includes('chats')) cssClass += ' chat';
        else if (msg.event?.includes('connection')) cssClass += ' connection';

        return `
                <div class="${cssClass}">
                    <div class="message-header">
                        <span class="event-badge">${eventLabel}</span>
                        <span class="timestamp">⏰ ${timestamp}</span>
                    </div>
                    
                    <div class="info-grid">
                        ${from !== 'N/A' ? `
                        <div class="info-item">
                            <div class="info-label">Contato</div>
                            <div class="info-value">${from}</div>
                        </div>
                        ` : ''}
                        
                        ${sender && sender !== 'N/A' ? `
                        <div class="info-item">
                            <div class="info-label">Remetente</div>
                            <div class="info-value">${sender}</div>
                        </div>
                        ` : ''}
                        
                        ${msg.instance ? `
                        <div class="info-item">
                            <div class="info-label">Instância</div>
                            <div class="info-value">${msg.instance}</div>
                        </div>
                        ` : ''}
                        
                        ${unreadCount !== undefined ? `
                        <div class="info-item">
                            <div class="info-label">Não Lidas</div>
                            <div class="info-value">${unreadCount}</div>
                        </div>
                        ` : ''}
                        
                        ${isFromMe !== undefined ? `
                        <div class="info-item">
                            <div class="info-label">Direção</div>
                            <div class="info-value">${isFromMe ? '📤 Enviada' : '📥 Recebida'}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${message ? `
                    <div class="message-content">
                        💬 ${message}
                    </div>
                    ` : ''}
                    
                    <div class="json-toggle">
                        <details>
                            <summary>🔍 Ver JSON completo</summary>
                            <pre class="json-data">${JSON.stringify(msg, null, 2)}</pre>
                        </details>
                    </div>
                </div>
              `;
    }).join('')}
        </div>
    </div>
    
    <script>
        function clearMessages() {
            if (confirm('Deseja limpar todos os eventos?')) {
                fetch('/api/clear', { method: 'POST' })
                    .then(() => location.reload());
            }
        }
        
        // Auto-refresh a cada 10 segundos
        setTimeout(() => location.reload(), 10000);
    </script>
</body>
</html>
  `);
});

app.post('/webhook', async (req, res) => {
    console.log('📱 Evento:', req.body.event);
    console.log('📦 Dados:', JSON.stringify(req.body, null, 2));

    // Armazenamento local (existente)
    messages.unshift({
        ...req.body,
        receivedAt: new Date().toISOString()
    });

    if (messages.length > 100) {
        messages = messages.slice(0, 100);
    }

    // Encaminhar para Spring Boot em background (não bloqueia resposta)
    if (FORWARD_ENABLED) {
        // Executar em background sem bloquear
        forwardToSpringBoot(req.body).catch(error => {
            console.error('Erro crítico no encaminhamento:', error.message);
        });
    } else {
        console.log('⚠️  Encaminhamento desabilitado via configuração');
    }

    // Responde imediatamente ao Evolution API
    res.json({ success: true });
});

app.post('/api/clear', (req, res) => {
    messages = [];
    res.json({ success: true });
});

app.get('/api/messages', (req, res) => {
    res.json(messages);
});

// ========================================
// Endpoint de Estatísticas de Encaminhamento
// ========================================
app.get('/api/forward-stats', (req, res) => {
    const successRate = forwardStats.total > 0
        ? ((forwardStats.success / forwardStats.total) * 100).toFixed(2)
        : 0;

    const failureRate = forwardStats.total > 0
        ? ((forwardStats.failed / forwardStats.total) * 100).toFixed(2)
        : 0;

    res.json({
        enabled: FORWARD_ENABLED,
        springBootUrl: SPRING_BOOT_URL,
        timeout: FORWARD_TIMEOUT,
        retryAttempts: RETRY_ATTEMPTS,
        stats: {
            ...forwardStats,
            successRate: `${successRate}%`,
            failureRate: `${failureRate}%`
        }
    });
});

// ========================================
// Endpoint de Health Check Spring Boot
// ========================================
app.get('/api/health', async (req, res) => {
    const checkSpringBoot = async () => {
        try {
            const healthUrl = SPRING_BOOT_URL.replace('/webhook/evolution', '/webhook/health');
            const response = await axios.get(healthUrl, { timeout: 3000 });
            return {
                status: 'UP',
                springBoot: {
                    reachable: true,
                    status: response.status,
                    url: healthUrl
                }
            };
        } catch (error) {
            return {
                status: 'DOWN',
                springBoot: {
                    reachable: false,
                    error: error.code === 'ECONNREFUSED'
                        ? 'Spring Boot offline'
                        : error.message,
                    url: SPRING_BOOT_URL
                }
            };
        }
    };

    const health = await checkSpringBoot();
    const httpStatus = health.status === 'UP' ? 200 : 503;

    res.status(httpStatus).json({
        monitor: {
            status: 'UP',
            forwardingEnabled: FORWARD_ENABLED,
            messagesStored: messages.length
        },
        ...health
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Servidor rodando na porta ' + PORT);
    console.log('🌐 Acesse no navegador!');
});