const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const SECRET_KEY = process.env.SECRET_SERVER_KEY;

app.post('/api/buy-ticket', async (req, res) => {
    try {
        const { event_name, owner_email } = req.body;
        const ticket_code = 'TKT-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        const dataToSign = `${ticket_code}:${event_name}:${owner_email}`;
        const digital_signature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(dataToSign)
            .digest('hex');

        const { data, error } = await supabase
            .from('tickets')
            .insert([{ event_name, owner_email, ticket_code, digital_signature, status: 'VALID' }])
            .select();

        if (error) throw error;
        res.json({ success: true, ticket_code, digital_signature, message: "Bilet uğurla alındı!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/verify-ticket', async (req, res) => {
    try {
        const { ticket_code } = req.body;
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('ticket_code', ticket_code)
            .single();

        if (error || !data) {
            return res.status(404).json({ valid: false, message: "Bilet tapılmadı!" });
        }

        if (data.status === 'USED') {
            return res.json({ valid: false, message: "XƏBƏRDARLIQ: Bu bilet artıq istifadə olunub!" });
        }

        const dataToSign = `${data.ticket_code}:${data.event_name}:${data.owner_email}`;
        const expectedSignature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(dataToSign)
            .digest('hex');

        if (expectedSignature !== data.digital_signature) {
            return res.json({ valid: false, message: "TƏHLÜKƏ: Biletin rəqəmsal imzası saxtadır!" });
        }

        await supabase
            .from('tickets')
            .update({ status: 'USED' })
            .eq('ticket_code', ticket_code);

        res.json({ valid: true, message: `Bilet ETİBARLIDIR! Xoş gəldiniz, ${data.owner_email}.` });
    } catch (err) {
        res.status(500).json({ valid: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server işləyir: http://localhost:${PORT}`);
});