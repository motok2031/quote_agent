import {
    Scraper,
} from "agent-twitter-client";
import { Database } from "./db";
import { CookieRecord, TweetData, UserData, UserId, MessageEvent, Message, upresponse } from "./types";
import { TwitterNetwork } from "./network";
import * as utils from "./utils";
import { call_llm } from "./assistant";
import * as prompts from "./prompts_tools_funcs";
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs/promises';
import fs1 from 'fs';
import Web3 from 'web3';
import { randomInt } from "crypto";
// 加载环境变量
dotenv.config();
const MEG_TABLE = 'message';
export class TwitterClient {
    userId: string;
    scraper: Scraper;
    network: TwitterNetwork;

    users: Set<string>;
    tochecklist: string[] = [];

    followings: string[] = [];
    followers: string[] = [];


    conversations_data = {}


    intervals: Record<string, NodeJS.Timeout> = {};

    trade_data: Record<string, Record<string, any>> = {};

    private sessionId: string | undefined;
    private listener_abort: (() => void | undefined) | undefined;
    private cursor: string | undefined;

    constructor() {
        this.scraper = new Scraper();
        this.network = new TwitterNetwork(this.scraper);
        this.users = new Set();
    }

    async setScraperCookies(scraper: Scraper, cookieArray: any[]) {
        const cookieStrings = cookieArray.map((cookie) => `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path || "/"}; ${cookie.secure ? "Secure" : ""}; ${cookie.httpOnly ? "HttpOnly" : ""}; SameSite=${cookie.sameSite || "Lax"}`);
        await scraper.setCookies(cookieStrings);
    }

    async loadCookiesFromDB(username: string) {
        const db = await Database.getInstance();
        const row = await db.read_item<CookieRecord>("cookies", username);
        if (row) return JSON.parse(row.cookies);
        else return undefined;
    }

    async saveCookiesToDB(username: string, cookie: any[]) {
        // 将cookie转换成json,然后转换成字符串
        const cookieStr = JSON.stringify(cookie);
        const db = await Database.getInstance();
        await db.write("cookies", username, { cookies: cookieStr });
    }

    async login(username: string, password: string, email: string) {

        // 尝试以用户名为key, 从db中读取cookies
        const cookie = await this.loadCookiesFromDB(username);
        if (cookie) {
            await this.setScraperCookies(this.scraper, cookie);
        }

        let retries = 3;
        while (retries > 0) {
            try {
                if (await this.scraper.isLoggedIn()) {
                    console.log('cached cookie login success')
                    break;
                } else {
                    await this.scraper.login(username, password, email);
                    if (await this.scraper.isLoggedIn()) {
                        // fresh login, store new cookies
                        console.log("account login success");
                        const cookies = await this.scraper.getCookies();
                        await this.saveCookiesToDB(username, cookies);
                        break;
                    }
                }
            } catch (error) {
                console.log(`Login attempt failed: ${error}`);
            }

            retries--;
            console.error(
                `Failed to login to Twitter. Retrying... (${retries} attempts left)`
            );

            if (retries === 0) {
                console.error(
                    "Max retries reached. Exiting login process."
                );
                throw new Error("Twitter login failed after maximum retries.");
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        console.log('login success')
        // Initialize Twitter profile
        const profile = await this.scraper.getProfile(username);
        console.log('profile success')
        if (profile) {
            this.userId = profile.userId;
            console.log("Twitter user ID:", this.userId, profile.name);
        } else {
            throw new Error("Failed to load profile");
        }

        await this.syncMessages({
            onMessage: async (message: Message) => {
                await this.handleMessage(message);
            }
        });
    }

    async loadData() {
        // 载入数据
        const db = await Database.getInstance();
        const userids = await db.find_items_with_column<string>("user", undefined, "id", 0, undefined);
        this.users = new Set(userids);

        await db.write("ids", undefined, { userId: "1857636237932445696", relateId: this.userId, type: "tocheck" });
        this.tochecklist = await db.find_items_with_column<string>("ids", { relateId: this.userId, type: "tocheck" }, "id", 0, undefined);
    }

    stop_intervals() {
        for (const key in this.intervals) {
            clearTimeout(this.intervals[key]);
        }
        this.intervals = {}
    }

    stoplisten() {
        this.listener_abort?.();
        this.listener_abort = undefined;
        this.sessionId = undefined;
    }

    async syncMessages(events: MessageEvent) {

        const conversations: Record<string, { lastupdate: number, messages: Record<string, Message> }> = {}
        const active_conversations: Record<string, string> = {}
        const file = "dm.txt"
        const DURING = 10 * 90 * 1000;
        function addtoconversations(message: Message) {//添加已存数据, 防止后续重复添加, 成功添加(过去没有)返回true,失败返回false
            const conversationId = message.conversationId;
            if (!conversations[conversationId]) {
                conversations[conversationId] = { lastupdate: message.timestamp, messages: {} };
            }
            if (!conversations[conversationId].messages[message.id]) {
                conversations[conversationId].lastupdate =
                    Number(message.timestamp) > Number(conversations[conversationId].lastupdate)
                        ? message.timestamp
                        : conversations[conversationId].lastupdate;
                conversations[conversationId].messages[message.id] = message;
                return true;
            } else {
                return false;
            }
        }
        async function LoadMessages(file: string) {
            const messages: Message[] = [];
            try {
                // 检查文件是否存在
                try {
                    await fs.access(file);
                } catch (error) {
                    // 文件不存在，创建空文件
                    await fs.writeFile(file, '', 'utf8');
                    return; // 文件是新创建的，没有消息可加载
                }

                const data = await fs.readFile(file, { encoding: 'utf8', flag: 'r' });
                const lines = data.split(/\r?\n/);
                lines.forEach(line => {
                    if (!line.trim()) return; // 跳过空行
                    try {
                        const message = JSON.parse(line) as Message;
                        messages.push(message);
                    } catch (error) {
                        console.log(`Failed to parse message: ${line}`);
                    }
                });

                for (const message of messages) {
                    addtoconversations(message)
                }
            } catch (error) {
                console.error(`Error loading messages from ${file}:`, error);
            }
        }
        await LoadMessages(file);

        async function tofile(file: string, message: Message) {
            //append到文件
            const content = JSON.stringify(message) + '\n'
            await fs.appendFile(file, content, { encoding: 'utf8', flush: true });
        }

        const listen = async () => {
            const ret = await this.network.listener3(this.userId, {
                onMessage: async (data: { topic: string; payload: any; }) => {
                    if (this.cursor) {

                        try {
                            const conversation_id = data.payload.dm_update.conversation_id;
                            const user_id = data.payload.dm_update.user_id;
                            if (user_id !== this.userId) {
                                await this.network.sendTyping(conversation_id)
                            }
                        } catch (e) {
                            console.log(e)
                        }

                        const dmresponse = await this.network.user_updates(this.cursor)
                        this.cursor = dmresponse.cursor;
                        for (const conversation of Object.values(dmresponse.conversations)) {
                            for (const message of conversation.messages) {
                                addcache(message)
                            }
                        }
                    }
                },
                onError: async (error: any) => {
                    this.stoplisten();
                }
            });
            this.listener_abort = ret.abort;
            this.sessionId = ret.sessionId;
        }


        //然后启动update_subscriptions
        const heartbeatInterval = setInterval(async () => {
            //遍历active_conversations
            const now_timestamp = Date.now();
            const conversationIds = Object.keys(active_conversations);
            const subscriptions: string[] = [];
            const unsubscriptions: string[] = [];
            //如果查conversation时间之内,添加订阅
            //否则添加到取消订阅
            for (const conversationId of conversationIds) {
                if (now_timestamp - Number(conversations[conversationId].lastupdate) < DURING) {
                    subscriptions.push(`/dm_update/${conversationId}`);
                } else {
                    unsubscriptions.push(`/dm_update/${conversationId}`);
                }
            }

            if (subscriptions.length > 0 || unsubscriptions.length > 0) {
                if (!this.sessionId) {
                    //首先启动SSE
                    await listen();
                }

                //将unsubscriptions中的元素从active_conversations中删除
                for (const topic of unsubscriptions) {
                    const conversationId = topic.replace('/dm_update/', '');
                    delete active_conversations[conversationId];
                }

                const ret = await this.network.updateSubscriptions(subscriptions, unsubscriptions, this.sessionId!)
                if (ret.success) {
                    // console.log('更新订阅成功!', ret.error);
                } else {
                    console.log('更新订阅失败!', ret.error);
                }

                if (Object.keys(active_conversations).length == 0) {
                    this.stoplisten();
                }
            }
        }, 60 * 1000);

        const addcache = async (message: Message) => {
            //添加进聊天缓存
            if (addtoconversations(message)) {
                //append到文件
                await tofile(file, message);

                events.onMessage(message);
            }

            //添加进active_conversations
            const new_timestamp = new Date().getTime();
            const conversationId = message.conversationId;
            if (new_timestamp - Number(conversations[conversationId].lastupdate) < DURING) {
                if (!active_conversations[conversationId]) {

                    active_conversations[conversationId] = "TODO";

                    if (!this.sessionId) {
                        //首先启动SSE
                        await listen();
                    }
                    const ret = await this.network.updateSubscriptions([`/dm_update/${conversationId}`], [], this.sessionId!)
                    if (ret.success) {
                        // console.log('订阅成功!',conversationId, ret.error);
                    } else {
                        console.log('订阅失败!', ret.error);
                    }
                }
            }
        }

        const userupdates = async () => {
            let dmresponse: upresponse = await this.network.user_updates(this.cursor)
            this.cursor = dmresponse.cursor;
            for (const conversation of Object.values(dmresponse.conversations)) {
                for (const message of conversation.messages) {
                    addcache(message)
                }
            }
            const dur = randomInt(4, 8)
            this.intervals.userupdates = setTimeout(userupdates, dur * 1000);
        }

        await userupdates()

        // 如果有不在活跃对话里的,先addActiveConversation,再拉取消息,同步
    }

    sendMessage = async (conversationId: string, text: string): Promise<Message | undefined> => {
        const message = await this.network.sendDirectMessage(conversationId, text)
        if (message) {
            const db = await Database.getInstance();
            await db.write(MEG_TABLE, message.id, { id: message.id, conversationId: conversationId, senderId: message.senderId, recipientId: message.recipientId, senderScreenName: message.senderScreenName, recipientScreenName: message.recipientScreenName, mediaUrls: message.mediaUrls, text: message.text, timestamp: message.timestamp });
        }
        return message
    }

    handleMessage = async (message: Message) => {
        const conversationId = message.conversationId;
        let senderId = message.senderId;
        let sender_username = message.senderScreenName;
        const recipientId = message.recipientId;
        const text = message.text;
        const timestamp = message.timestamp;
        const messageId = message.id;

        // await this.network.sendTyping(conversationId);
        const db = await Database.getInstance();

        if (senderId == this.userId) return;

        const myself_twitter = "tweetsdotai"

        try {
            let shown_url = false
            await db.write(MEG_TABLE, messageId, { id: messageId, conversationId: conversationId, senderId: senderId, recipientId: recipientId, senderScreenName: sender_username, recipientScreenName: message.recipientScreenName, mediaUrls: message.mediaUrls, text: text, timestamp: timestamp });
            // 如果读取没有信息, 则写入user
            const userdata = await db.read_item<UserData>('user', senderId);
            if (!userdata) {
                await db.write('user', senderId, { id: senderId, username: sender_username, last_update: new Date().toISOString() });
            }

            let activity = undefined
            const activities = JSON.parse(fs1.readFileSync("activities.json", 'utf8'));
            const activities_ids = activities.map((activity: any) => activity.id);
            // 获取trade_item
            const trade_item = await db.find_items<any>('trade', { userId: senderId });
            for (const item of trade_item) {
                if (activities_ids.includes(item.activityId)) {
                    activities_ids.splice(activities_ids.indexOf(item.activityId), 1);
                }
            }
            if (activities_ids.length > 0) {
                const activityId = activities_ids[0];
                activity = activities.find((activity: any) => activity.id === activityId);
            }

            const get_activity_introduction_func = async () => {
                const twitter = `${activity.twitter}`
                const tweetId = activity.tweetId;
                // const tweet_url = `https://x.com/${activity.twitter}/status/${tweetId}`
                if (!this.trade_data[senderId]) {
                    this.trade_data[senderId] = {};
                }
                if (!this.trade_data[senderId][tweetId]) {
                    this.trade_data[senderId][tweetId] = true;
                    const tweet_url = `https://x.com/${activity.twitter}/status/${tweetId}`
                    await this.sendMessage(message.conversationId, tweet_url);
                    shown_url = true;
                }
                const price = activity.price;
                return await Promise.resolve(`Follow @${twitter}, and quote the tweet above, you will get ${price} $BNB reward`);
            }

            const func = async (args: any) => {
                console.log("func", args)
                let task = undefined
                function append(app: string) {
                    if (!task) { task = app }
                    else { task += "|" + app }
                }

                if (args.type == "nothing") {
                    return Promise.resolve("");
                }

                if (activities.length == 0) {// 没有活动了
                    let text = "Tell the user there are no active activities. "
                    const isFollowing = await this.verify_following(senderId, myself_twitter);
                    if (!isFollowing) {
                        text += `you can follow @${myself_twitter} to get future activities`;
                    }
                    return Promise.resolve(text);
                }

                if (activities.length > 0 && activities_ids.length == 0) {//有活动, 但是你参加完了
                    let text = "Tell the user you have completed all activities. "
                    const isFollowing = await this.verify_following(senderId, myself_twitter);
                    if (!isFollowing) {
                        text += `you can follow @${myself_twitter} to get future activities`;
                    }
                    return Promise.resolve(text);
                }

                // TODO 增加判断用户是否是僵尸号, 不能参与活动

                if (!activity) {
                    return Promise.resolve(`Tell the user you do not have the qualifications to participate in the activity`);
                }

                if (args.type == "address") {
                    const isValid = Web3.utils.isAddress(args.data);
                    if (isValid) {
                        await db.write('user', senderId, { evm_addr: Web3.utils.toChecksumAddress(args.data) });
                    } else {
                        // return Promise.resolve("告诉用户, 为了完成活动, 你需要提供一个有效的bsc链的BNB收款地址");
                        append("Tell the user you need to provide a valid BSC address to complete the activity");
                    }
                }
                const twitter = `${activity.twitter}`
                const isFollowing = await this.verify_following(senderId, twitter);
                if (!isFollowing) {
                    append(`Tell the user you need to follow @${twitter} to complete the activity`);
                }
                const tweetId = activity.tweetId;

                const isQuote = await this.verify_quote(senderId, tweetId);
                if (!isQuote) {
                    if (!this.trade_data[senderId]) {
                        this.trade_data[senderId] = {};
                    }
                    if (!this.trade_data[senderId][tweetId]) {
                        this.trade_data[senderId][tweetId] = true;
                        const tweet_url = `https://x.com/${activity.twitter}/status/${tweetId}`
                        await this.sendMessage(message.conversationId, tweet_url);
                        shown_url = true;
                    }

                    append(`Tell the user you need to quote the tweet above to complete the activity`);
                }

                const userdata = await db.read_item<UserData>('user', senderId);

                if (!userdata || !userdata.evm_addr) {
                    append(`Tell the user you need to provide a valid BSC address to receive the reward`);
                }

                if (!task) {
                    const evm_addr = userdata.evm_addr;
                    const price = activity.price;
                    const transactionHash = await this.sendBNB(evm_addr, price);

                    append(`Tell the user we have completed the transaction, we have paid you the hash ${transactionHash}.`);

                    let text = "Tell the user the activity is completed, thank you for your participation."
                    const isFollowing = await this.verify_following(senderId, myself_twitter);
                    if (!isFollowing) {
                        text += `you can follow @${myself_twitter} to get future activities`;
                    }
                    append(text);
                }

                return Promise.resolve(task);
            }

            // 获取历史对话
            const message_items = await db.find_items<Message>(MEG_TABLE, { conversationId: conversationId });
            message_items.sort((a, b) => a.timestamp - b.timestamp);
            const messages = message_items.map(item => ({
                role: item.senderId == this.userId ? 'assistant' : 'user',
                content: item.text
            }));
            // 调用llm
            // console.log("messages",messages)
            let response = await call_llm<string>(
                prompts.func_module,
                prompts.func_prompt(),
                messages,
                [
                    prompts.func_tool as any,
                    prompts.get_activity_introduction_tool as any
                ],
                [
                    func,
                    get_activity_introduction_func
                ],
            );
            // 结果记录, 发送
            console.log("user", message.senderScreenName, message.text);
            console.log("assistant", response);
            if (response.length > 0) {
                let language = undefined

                if (shown_url) {
                    const content = messages.map(item => (item.role == 'user' ? item.content : '')).join('\n');
                    language = await call_llm<string>(
                        prompts.func_quote_text_module,
                        prompts.quote_lang_prompt(),
                        [{ role: 'user', content }],
                        [],
                        []
                    );
                    const bytheway_result = await call_llm<string>(
                        prompts.func_quote_text_module,
                        prompts.quote_bytheway_prompt(),
                        [{ role: 'user', content: language }],
                        [],
                        []
                    );
                    response += `\n\n${bytheway_result}`
                }

                const send_message = await this.sendMessage(message.conversationId, response as any);

                if (shown_url) {
                    const profile = await this.scraper.getProfile(sender_username)
                    const bio = profile.biography;
                    const text = "Influence AI — Turn Social Capital into Real Capital"

                    const response_quote = await call_llm<string>(
                        prompts.func_quote_text_module,
                        prompts.quote_prompt(text, bio, language),
                        [],
                        [],
                        []
                    );
                    await this.sendMessage(message.conversationId, response_quote as any);
                }

                if (send_message && send_message.text && send_message.text.includes(`@${myself_twitter}`)) {
                    await this.clear_conversation(message.conversationId, senderId, activity);
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    async clear_conversation(conversationId: string, senderId: string, activity: any) {
        const db = await Database.getInstance();
        const messages = await db.find_items<Message>(MEG_TABLE, { conversationId: conversationId });
        const messages_texts: string[] = messages.map(item => item.text);
        if (activity) {
            const trade = { userId: senderId, activityId: activity.id, messages: messages_texts, updated_at: new Date().toISOString() };
            await db.write('trade', undefined, trade);
        }
        if (messages.length > 0) {
            // 删除messages里的记录
            const messages_ids = messages.map(item => item.id);
            await db.delete_items('message', messages_ids);
        }
    }

    async verify_following(userId: string, username: string): Promise<boolean> {
        if (!username) return false
        let cursor = undefined
        while (true) {
            const res = await this.get_followers('following', userId, 40, cursor)
            if (res.users.length === 0) {
                return false
            }
            cursor = res.nextCursor
            for (const user of res.users) {
                if (user.username == username) {
                    return true
                }
            }
            //当前休息1秒钟
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    async get_followers(type: 'following' | 'followers', userId: string, count: number = 40, cursor?: string) {

        const graphql_dict = {
            'following': 'i-MoRLrTX8WkKArgoEb52g',
            'followers': '1eK782QvgoVb8O31q38dNw'
        }
        const reqstr_dict = {
            'following': 'Following',
            'followers': 'Followers'
        }

        return await this.network.fetchFollowers(graphql_dict[type], reqstr_dict[type], userId, count, cursor)
    }

    async verify_quote(userId: string, tweetId: string, max_count: number = 1000): Promise<boolean> {
        const tweets = []
        let cursor = undefined
        while (true) {
            const res = await this.network.getUserTweets('QoPVD4OX7b-HuIvsiIezVA', userId, { tco: false, image_describ: false }, 20, cursor)
            // console.log(res.tweets.map(tweet => tweet.id))
            if (res.tweets.length === 0) return false
            for (const tweet of res.tweets) {
                if (tweet.quted_tweet_id == tweetId) {
                    return true
                }
            }
            cursor = res.bottom_cursor
            tweets.push(...res.tweets)
            if (tweets.length >= max_count) return false
            //当前休息1秒钟
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        return false
    }

    async sendBNB(toaddr: string, amount: number): Promise<string> {
        const web3 = new Web3(process.env.BSC_RPC_URL); // 公共 RPC 节点
        const privateKey = process.env.BSC_PRIVATE_KEY; // 不要泄露！
        const senderAddress = process.env.BSC_SENDER_ADDRESS; // 你的地址
        const receiverAddress = toaddr;
        const nonce = await web3.eth.getTransactionCount(senderAddress, 'pending');
        const gasLimit = await web3.eth.estimateGas({
            from: senderAddress,
            to: receiverAddress,
            value: web3.utils.toWei(amount, 'ether'),
        });
        const tx = {
            from: senderAddress,
            to: receiverAddress,
            value: web3.utils.toWei(amount, 'ether'), // 0.01 BNB
            gas: gasLimit,
            gasPrice: await web3.eth.getGasPrice(),
            nonce,
            chainId: 56, // BNB Chain 主网
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction!);

        return receipt.transactionHash.toString()
    }
}