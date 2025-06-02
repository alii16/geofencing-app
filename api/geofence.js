// api/geofence.js

// Handler untuk Vercel Function
export default async function handler(req, res) {
    // Hanya izinkan metode POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- Definisi Token dan Chat ID secara Hardcode ---
    // PENTING: Ganti dengan token dan chat ID Anda yang sebenarnya
    const TELEGRAM_BOT_TOKEN = '7732580165:AAEehBEHZRuzzQyXu3BybTWf8pWR0Nm9uMQ'; // GANTI DENGAN TOKEN BOT ANDA
    const TELEGRAM_CHAT_ID = '1985797056'; // GANTI DENGAN ID CHAT TELEGRAM ANDA
    // --- Akhir Definisi Hardcode ---

    // Ambil pesan dari body request
    const { text } = req.body;

    // Validasi bahwa pesan ada
    if (!text) {
        return res.status(400).json({ error: 'Text message is required in the request body.' });
    }

    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        const telegramResponse = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'Markdown' // Opsi: 'HTML' atau 'Markdown'
            })
        });

        const data = await telegramResponse.json();

        if (telegramResponse.ok) {
            console.log('Telegram API response:', data);
            res.status(200).json({ message: 'Notification sent!', data: data });
        } else {
            console.error('Telegram API error:', data);
            res.status(telegramResponse.status).json({ error: data.description || 'Failed to send Telegram message', telegram_response: data });
        }
    } catch (error) {
        console.error('Error sending message to Telegram:', error);
        res.status(500).json({ error: 'Internal server error while sending Telegram message.' });
    }
}