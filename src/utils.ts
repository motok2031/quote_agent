import { Profile, Tweet } from "agent-twitter-client"
import { TweetData, UserData } from "./types"
import { ImageDescriptionService } from "./image/image"

export function profile_2_userdata(profile: Profile) {
    // console.log('profile_2_userdata', profile.username)
    const userData: UserData = {
        id: profile.userId,
        username: profile.username,
        screenname: profile.name,
        profile_image_url: profile.avatar,
        description: profile.biography,
        created_at: profile.joined?.getTime(),
        tweet_count: profile.tweetsCount,
        follower_count: profile.followersCount,
        following_count: profile.followingCount,
        last_update: Date.now()
    }
    return userData
}

export function remove_tco(text: string) {
    const twitterUrlPattern = /https:\/\/t\.co\/[a-zA-Z0-9]{10}/g;
    return text.replaceAll(twitterUrlPattern, '');
}

export async function handle_tweet(tweet: Tweet) {
    tweet.text = await replace_tcos(tweet.text)
}

export async function replace_tcos(text: string) {
    const twitterUrlPattern = /https:\/\/t\.co\/[a-zA-Z0-9]{10}/g;
    const matches = text.match(twitterUrlPattern) || [];
    let new_text = text
    for (const match of matches) {
        const parsedUrl = await parse_url(match);
        // console.log('parsedUrl', match, parsedUrl)
        new_text = new_text.replace(match, parsedUrl);
    }
    return new_text
}

export async function parse_url(url: string) {
    try {
        // 检查URL是否是t.co短链接
        if (url.includes('t.co')) {
            // 使用fetch发送请求，但不跟随重定向
            const response = await fetch(url, {
                method: 'HEAD', // 只获取头信息，不需要内容
                redirect: 'manual' // 不自动跟随重定向
            });

            // 从响应头中获取重定向的真实URL
            if (response.status >= 300 && response.status < 400) {
                const redirectUrl = response.headers.get('location');
                if (redirectUrl) {
                    return redirectUrl;
                }
            }
        }

        // 如果不是短链接或者没有重定向，则返回原始URL
        return url;
    } catch (error) {
        console.error('解析URL时出错:', error);
        return url; // 出错时返回原始URL
    }
}

export function tweet_2_data(tweet: Tweet) {
    const data: TweetData = {
        id: tweet.id,
        text: tweet.text,
        userId: tweet.userId,

        bookmark_count: tweet.bookmarkCount,
        retweet_count: tweet.retweets,
        reply_count: tweet.replies,
        quote_count: tweet.quotedStatus?.retweets,
        view_count: tweet.views,
        like_count: tweet.likes,

        hashtags: tweet.hashtags,
        user_mentions: tweet.mentions.map(mention => mention.username),
        media: tweet.photos.map(photo => photo.url),
        media_description: tweet.photos.map(photo => photo.alt_text).join(','),
        retweet_id: tweet.retweetedStatus?.id,
        quted_tweet_id: tweet.quotedStatus?.id,
        lang: undefined,
        created_at: tweet.timestamp
    }
    return data
}

export async function get_image_description(medias: string[]): Promise<{ title: string, description: string }[]> {
    const image_description_service = new ImageDescriptionService();
    const image_descriptions: { title: string, description: string }[] = []
    for (const media of medias) {
        const { title, description } = await image_description_service.describeImage(media);
        console.log('image describe:', title, description)
        image_descriptions.push({ title, description })
    }
    return image_descriptions
}

export function isMention(str: string): boolean {
    // 检查是否以@开头，后面跟字母、数字或下划线，至少1个字符
    const mentionPattern = /^@[a-zA-Z0-9_]+$/;
    return mentionPattern.test(str);
}

