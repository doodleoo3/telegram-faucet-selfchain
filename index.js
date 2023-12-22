const TelegramBot = require('node-telegram-bot-api');
const shell = require("shelljs");
const { token, walletName, walletPass, tokensAmount } = require('./config.json');

const bot = new TelegramBot(token, { polling: true });
const lastRequestTime = {};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'ENTER YOUR SELFCHAIN WALLET ADDRESS:', {
        reply_markup: {
            force_reply: true,
        },
    });
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    if (msg.reply_to_message && msg.reply_to_message.text.includes('ENTER YOUR SELFCHAIN WALLET ADDRESS:') || msg.reply_to_message && msg.reply_to_message.text.includes('YOU ENTERED AN INCORRECT ADDRESS')) {
        const walletAddress = msg.text;
        const userId = msg.from.id;

        const now = new Date();
        if (lastRequestTime[userId]) {
            const lastRequest = new Date(lastRequestTime[userId]);
            const differenceInHours = (now - lastRequest) / (1000 * 60 * 60);

            if (differenceInHours < 24) {
                bot.sendMessage(chatId, `❌ COOLDOWN EXPIRES IN ${Math.trunc(24 - differenceInHours)} HOURS, TRY AGAIN LATER\n\nTO USE FAUCET AGAIN, ENTER - /start`);
                return;
            }
        }

        const walletRegex = /^self1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38}$/;
        if (!walletRegex.test(walletAddress)) {
            bot.sendMessage(chatId, '❌ YOU ENTERED AN INCORRECT ADDRESS.\n\nPLEASE ENTER THE CORRECT SELFCHAIN WALLET ADDRESS:', {
                reply_markup: {
                    force_reply: true,
                },
            });
        } else {
            lastRequestTime[userId] = now.toISOString();

            const cmdSendTokens = `echo -e "${walletPass}\\n${walletPass}\\n" | selfchaind tx bank send ${walletName} ${walletAddress} ${tokensAmount}uself --fees 10000uself --gas 400000 -y`
            const sendTokens = shell.exec(cmdSendTokens, { shell: '/bin/bash', silent: true });
            if (!sendTokens.stderr) {

                const transactionOutput = sendTokens.stdout;
                let txHash;

                const regex = /txhash:\s*([A-F0-9]+)/;
                const match = transactionOutput.match(regex);

                if (match && match[1]) {
                    txHash = match[1];
                    bot.sendMessage(chatId, `✅ TRANSACTION WAS SENT: [${txHash}](https://explorer-devnet.selfchain.xyz/self/transactions/${txHash})\n\n${tokensAmount / 1000000}SELF SUCCESSFULLY TRANSFERRED TO ${walletAddress}\n\nTO USE FAUCET AGAIN, ENTER - /start`, { parse_mode: "Markdown" });
                } else {
                    bot.sendMessage(chatId, `❌ FAILED TO GET TRANSACTION HASH, TRY AGAIN LATER\n\nTO USE FAUCET AGAIN, ENTER - /start`);
                }
            } else {
                bot.sendMessage(chatId, `❌ TRANSACTION WAS FAILED, TRY AGAIN LATER\n\nTO USE FAUCET AGAIN, ENTER - /start`);
            }
        }
    }
});