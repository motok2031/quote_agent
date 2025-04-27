export type CookieRecord = {
    username: string;
    cookies: string;
}

export interface Message {
    id: string;
    timestamp: number;
    conversationId: string;
    senderId: string;
    recipientId: string;
    senderScreenName: string;
    recipientScreenName: string;
    mediaUrls: string[];
    text: string;
}

export interface MessageEvent {
    onMessage: (message: Message) => void;
}

export interface StreamEvents {
    onMessage: (data: { topic: string; payload: any; }) => Promise<void>;
    onError?: (error: any) => Promise<void>;
}

export interface upresponse {
    cursor?: string;
    conversations: Record<string, {
        messages: Message[]
    }>
}

export interface TweetData {
    id: string;
    text: string;
    userId: string;
    retweet_count: number;         // Retweet count
    reply_count: number;           // Reply count
    like_count: number;            // Like count
    quote_count: number;           // Quote count
    view_count?: number;           // View count
    bookmark_count?: number;       // Bookmark count
    hashtags: string[]; // Hashtags
    user_mentions: string[]; // Mentioned users
    media: string[]; // Media
    media_description: string; // Media description
    retweet_id: string; // Original retweet ID
    quted_tweet_id: string; // Quoted tweet ID
    lang: string; // Language
    created_at: number;
}

export interface UserData {
    id: string;                    // User ID
    username: string;               // @Username
    screenname: string;            // Display name
    profile_image_url: string;     // Profile image URL
    tweet_count: number;          // Tweet count
    follower_count: number;       // Follower count
    following_count: number;       // Following count
    description?: string;          // User description
    evm_addr?: string;             // EVM address
    created_at: number;             // Account creation time
    last_update: number;           // Last program check time
}

// Complete timeline data
export interface TimelineData {
    tweets: TweetData[];       // Tweet list
    users: UserData[];             // User list
    top_cursor?: string;   // Top cursor
    bottom_cursor?: string;// Bottom cursor
}

export interface TweetEvent {
    success: boolean;
    event: string;
    view: string[];
    keywords: string[];
}

export interface UserId {
    id: string;
    userId: string;
    relateId: string;
    type: string;
}

export interface FollowersData {
    users: User[]; // 你可以定义更具体的 User 类型
    nextCursor?: string;
}
// 定义 User 类型 (示例，根据需要调整)
export interface User {
    id: string;
    username: string;
    screenname: string;
    description: string;
    followers_count: number;
    following_count: number;
    // 添加其他你需要的字段
}