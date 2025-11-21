const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.send('🟢 Webhook WhatsApp ativo!');
});

app.post('/webhook', (req, res) => {
    console.log('\n📱 ========== EVENTO WHATSAPP ==========');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('📌 Evento:', req.body.event);
    console.log('📦 Instância:', req.body.instance);
    console.log('💾 Dados completos:');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('=====================================\n');

    if (req.body.event === 'messages.upsert') {
        const message = req.body.data?.message;
        const from = req.body.data?.key?.remoteJid;
        const isFromMe = req.body.data?.key?.fromMe;

        if (!isFromMe) {
            console.log('💬 Mensagem de:', from);
            console.log('📝 Conteúdo:', message?.conversation || message?.extendedTextMessage?.text || 'Mídia');
        }
    }

    res.status(200).json({ success: true, received: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('✅ Webhook rodando na porta', PORT);
});