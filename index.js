const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

// Array para armazenar últimas 100 mensagens
let messages = [];

// Broadcast para todos os clientes conectados
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Rota da interface
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webhook WhatsApp - Monitor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
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
        
        .header h1 {
            color: #333;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px;
            background: #10b981;
            color: white;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }
        
        .status.disconnected {
            background: #ef4444;
        }
        
        .status-dot {
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
            max-height: 600px;
            overflow-y: auto;
        }
        
        .messages h2 {
            margin-bottom: 20px;
            color: #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .clear-btn {
            background: #ef4444;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .clear-btn:hover {
            background: #dc2626;
        }
        
        .message-item {
            background: #f9fafb;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 8px;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .message-item.received {
            border-left-color: #10b981;
        }
        
        .message-item.sent {
            border-left-color: #3b82f6;
        }
        
        .message-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .event-type {
            font-weight: bold;
            color: #667eea;
            font-size: 14px;
        }
        
        .timestamp {
            color: #999;
            font-size: 12px;
        }
        
        .message-from {
            color: #666;
            font-size: 13px;
            margin-bottom: 8px;
        }
        
        .message-content {
            background: white;
            padding: 12px;
            border-radius: 5px;
            color: #333;
            font-size: 14px;
            word-break: break-word;
        }
        
        .message-data {
            margin-top: 10px;
            background: #f3f4f6;
            padding: 10px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #666;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .no-messages {
            text-align: center;
            padding: 60px 20px;
            color: #999;
        }
        
        .no-messages svg {
            width: 80px;
            height: 80px;
            margin-bottom: 20px;
            opacity: 0.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 Webhook WhatsApp Monitor</h1>
            <div class="status" id="status">
                <div class="status-dot"></div>
                <span>Conectado</span>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>Total de Eventos</h3>
                <div class="value" id="totalEvents">0</div>
            </div>
            <div class="stat-card">
                <h3>Mensagens Recebidas</h3>
                <div class="value" id="messagesReceived">0</div>
            </div>
            <div class="stat-card">
                <h3>Mensagens Enviadas</h3>
                <div class="value" id="messagesSent">0</div>
            </div>
            <div class="stat-card">
                <h3>Outros Eventos</h3>
                <div class="value" id="otherEvents">0</div>
            </div>
        </div>
        
        <div class="messages">
            <h2>
                Eventos em Tempo Real
                <button class="clear-btn" onclick="clearMessages()">Limpar</button>
            </h2>
            <div id="messagesList">
                <div class="no-messages">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                    </svg>
                    <p>Aguardando eventos...</p>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        let totalEvents = 0;
        let messagesReceived = 0;
        let messagesSent = 0;
        let otherEvents = 0;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(protocol + '//' + window.location.host);
        
        ws.onopen = () => {
            document.getElementById('status').classList.remove('disconnected');
            document.getElementById('status').innerHTML = '<div class="status-dot"></div><span>Conectado</span>';
        };
        
        ws.onclose = () => {
            document.getElementById('status').classList.add('disconnected');
            document.getElementById('status').innerHTML = '<div class="status-dot"></div><span>Desconectado</span>';
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            addMessage(data);
            updateStats(data);
        };
        
        function addMessage(data) {
            const messagesList = document.getElementById('messagesList');
            const noMessages = messagesList.querySelector('.no-messages');
            if (noMessages) noMessages.remove();
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-item';
            
            if (data.event === 'messages.upsert' && data.data?.key?.fromMe === false) {
                messageDiv.classList.add('received');
            } else if (data.event === 'messages.upsert' && data.data?.key?.fromMe === true) {
                messageDiv.classList.add('sent');
            }
            
            const timestamp = new Date().toLocaleString('pt-BR');
            const from = data.data?.key?.remoteJid || 'N/A';
            const message = data.data?.message?.conversation || 
                           data.data?.message?.extendedTextMessage?.text || 
                           'Mídia/Outro tipo';
            
            messageDiv.innerHTML = \`
                <div class="message-header">
                    <span class="event-type">\${data.event || 'unknown'}</span>
                    <span class="timestamp">\${timestamp}</span>
                </div>
                \${from !== 'N/A' ? \`<div class="message-from">De: \${from}</div>\` : ''}
                \${message !== 'Mídia/Outro tipo' ? \`<div class="message-content">\${message}</div>\` : ''}
                <details>
                    <summary style="cursor: pointer; color: #667eea; font-size: 12px; margin-top: 10px;">Ver dados completos</summary>
                    <div class="message-data">\${JSON.stringify(data, null, 2)}</div>
                </details>
            \`;
            
            messagesList.insertBefore(messageDiv, messagesList.firstChild);
            
            while (messagesList.children.length > 50) {
                messagesList.removeChild(messagesList.lastChild);
            }
        }
        
        function updateStats(data) {
            totalEvents++;
            document.getElementById('totalEvents').textContent = totalEvents;
            
            if (data.event === 'messages.upsert') {
                if (data.data?.key?.fromMe === false) {
                    messagesReceived++;
                    document.getElementById('messagesReceived').textContent = messagesReceived;
                } else {
                    messagesSent++;
                    document.getElementById('messagesSent').textContent = messagesSent;
                }
            } else {
                otherEvents++;
                document.getElementById('otherEvents').textContent = otherEvents;
            }
        }
        
        function clearMessages() {
            const messagesList = document.getElementById('messagesList');
            messagesList.innerHTML = \`
                <div class="no-messages">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                    </svg>
                    <p>Aguardando eventos...</p>
                </div>
            \`;
        }
    </script>
</body>
</html>
  `);
});

// Rota do webhook
app.post('/webhook', (req, res) => {
    console.log('📱 Evento recebido:', req.body.event);
    console.log('📦 Dados:', JSON.stringify(req.body, null, 2));

    messages.unshift({
        ...req.body,
        receivedAt: new Date().toISOString()
    });

    if (messages.length > 100) {
        messages = messages.slice(0, 100);
    }

    broadcast(req.body);

    res.json({ success: true });
});

// Rota para pegar histórico
app.get('/api/messages', (req, res) => {
    res.json(messages);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Servidor rodando na porta ' + PORT);
    console.log('🌐 Acesse: http://localhost:' + PORT);
});