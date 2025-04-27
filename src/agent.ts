import { TwitterClient } from "./twitterclient";


export class Agent {
    private twiter_client: TwitterClient;

    constructor() {
        this.twiter_client = new TwitterClient();
    }

    async start() {
        console.log('[start]');

        // Login
        await this.login();
    }

    async login() {

        const username = process.env.TWITTER_USERNAME;
        const password = process.env.TWITTER_PASSWORD;
        const email = process.env.TWITTER_EMAIL;
        console.log('[login]', username);
        await this.twiter_client.login(username, password, email);
    }

    async loadData() {
        console.log('[loadData]');
        // Load data
        await this.twiter_client.loadData();
    }

    async run(params: { type: "address" | "push", data: string }[]): Promise<{ type: "retweet" | "follow" | "taskaddr" | "success", data: string }[]> {
        return Promise.resolve([])
    }
}
