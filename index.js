const express = require('express');
const app = express();

app.use(express.json());

let messages = [];

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

app.post('/webhook', (req, res) => {
    console.log('📱 Evento:', req.body.event);
    console.log('📦 Dados:', JSON.stringify(req.body, null, 2));

    messages.unshift({
        ...req.body,
        receivedAt: new Date().toISOString()
    });

    if (messages.length > 100) {
        messages = messages.slice(0, 100);
    }

    res.json({ success: true });
});

app.post('/api/clear', (req, res) => {
    messages = [];
    res.json({ success: true });
});

app.get('/api/messages', (req, res) => {
    res.json(messages);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Servidor rodando na porta ' + PORT);
    console.log('🌐 Acesse no navegador!');
});