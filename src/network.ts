import { EventSource, FetchLikeInit } from 'eventsource';
import { TimelineData, UserData, TweetData, FollowersData, User,StreamEvents, upresponse, Message } from "./types";
import { updateCookieJar } from "./utils_cookies";
import * as utils from "./utils";
const cookie_url = 'https://twitter.com';
// const user_agent = 'Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36'
const user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
const features = {
    rweb_video_screen_enabled: false,  // 是否启用网页版视频播放界面
    profile_label_improvements_pcf_label_in_post_enabled: true,  // 是否在帖子中启用个人资料标签改进
    rweb_tipjar_consumption_enabled: true,  // 是否启用打赏功能
    responsive_web_graphql_exclude_directive_enabled: true,  // 是否启用GraphQL查询排除指令
    verified_phone_label_enabled: false,  // 是否显示已验证电话号码标签
    creator_subscriptions_tweet_preview_api_enabled: true,  // 是否启用创作者订阅推文预览API
    responsive_web_graphql_timeline_navigation_enabled: true,  // 是否启用时间线导航功能
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,  // 是否跳过加载用户头像扩展信息
    premium_content_api_read_enabled: false,  // 是否启用付费内容阅读功能
    communities_web_enable_tweet_community_results_fetch: true,  // 是否启用社区推文结果获取
    c9s_tweet_anatomy_moderator_badge_enabled: true,  // 是否显示版主徽章
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,  // 是否启用Grok分析按钮获取趋势
    responsive_web_grok_analyze_post_followups_enabled: true,  // 是否启用Grok分析帖子后续内容
    responsive_web_jetfuel_frame: false,  // 是否启用JetFuel框架
    responsive_web_grok_share_attachment_enabled: true,  // 是否启用Grok分享附件功能
    articles_preview_enabled: true,  // 是否启用文章预览功能
    responsive_web_edit_tweet_api_enabled: true,  // 是否启用推文编辑API
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,  // 是否启用推文翻译功能
    view_counts_everywhere_api_enabled: true,  // 是否启用全局查看次数统计
    longform_notetweets_consumption_enabled: true,  // 是否启用长篇推文阅读功能
    responsive_web_twitter_article_tweet_consumption_enabled: true,  // 是否启用Twitter文章消费功能
    tweet_awards_web_tipping_enabled: false,  // 是否启用推文打赏功能
    responsive_web_grok_analysis_button_from_backend: true,  // 是否从后端获取Grok分析按钮
    creator_subscriptions_quote_tweet_preview_enabled: false,  // 是否启用创作者订阅引用推文预览
    freedom_of_speech_not_reach_fetch_enabled: true,  // 是否启用言论自由相关功能
    standardized_nudges_misinfo: true,  // 是否启用标准化误导信息提示
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,  // 是否优先使用GQL限制操作策略
    rweb_video_timestamps_enabled: true, // 是否启用视频时间戳功能
    longform_notetweets_rich_text_read_enabled: true,  // 是否启用长篇富文本推文阅读
    longform_notetweets_inline_media_enabled: true,  // 是否启用长篇推文内联媒体
    responsive_web_grok_image_annotation_enabled: true,  // 是否启用Grok图像注释功能
    responsive_web_enhance_cards_enabled: false  // 是否启用增强卡片功能
};
const fieldToggles = {
    withArticlePlainText: false  // 是否使用纯文本文章格式
};
const follow_features = {
    rweb_video_screen_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_enhance_cards_enabled: false
}
export class TwitterNetwork {

    constructor(private readonly scraper: any) {
        this.scraper = scraper;
    }

    get auth() {
        return (this.scraper as any).auth;
    }

    async getheaders(auth: any, authtype: 'OAuth2Client' | 'OAuth2Session' = 'OAuth2Client'): Promise<Headers> {
        const cookiejar = await auth.cookieJar()
        const cookies = await cookiejar.getCookies(cookie_url);
        const xCsrfToken = cookies.find((cookie) => cookie.key === 'ct0');
        let cookie = await cookiejar.getCookieString(cookie_url);
        cookie += `guest_id=${cookies.guest_id_ads};`
        return new Headers({
            authorization: `Bearer ${auth.bearerToken}`,
            cookie,
            'content-type': 'application/json',
            'User-Agent': user_agent,
            'x-guest-token': auth.guestToken,
            'x-twitter-auth-type': authtype,
            'x-twitter-active-user': 'yes',
            "x-csrf-token": xCsrfToken?.value as string,
            referer: 'https://x.com/home',
            'sec-ch-ua': `"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"`,
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': `"macOS"`,
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'x-twitter-client-language': 'en'
        });
    }

    get_conversation_params(): URLSearchParams {
        const params = new URLSearchParams();
        params.append('cards_platform', 'Web-12');
        params.append('include_cards', '1');
        params.append('include_ext_alt_text', 'true');
        params.append('include_ext_limited_action_results', 'true');
        params.append('include_quote_count', 'true');
        params.append('include_reply_count', '1');
        params.append('tweet_mode', 'extended');
        params.append('include_ext_views', 'true');
        params.append('include_groups', 'true');
        params.append('include_inbox_timelines', 'true');
        params.append('include_ext_media_color', 'true');
        params.append('include_quality', 'all');
        params.append('supports_reactions', 'true');
        params.append('supports_edit', 'true');
        params.append('ext', 'mediaColor,altText,businessAffiliationsLabel,mediaStats,highlightedLabel,parodyCommentaryFanLabel,voiceInfo,birdwatchPivot,superFollowMetadata,unmentionInfo,editControl,article');

        params.append('dm_users', 'false');
        params.append('nsfw_filtering_enabled', 'false');
        params.append('filter_low_quality', 'false');
        params.append('dm_secret_conversations_enabled', 'false');
        params.append('krs_registration_enabled', 'true');
        params.append('include_ext_edit_control', 'true');
        params.append('include_ext_business_affiliations_label', 'true');

        return params;
    }

    get_update_user_params(): URLSearchParams {
        const params = new URLSearchParams();
        params.append('nsfw_filtering_enabled', 'false');  // 是否启用NSFW过滤
        params.append('filter_low_quality', 'false');  // 是否过滤低质量内容
        params.append('include_quality', 'all');  // 包含所有质量内容
        params.append('dm_secret_conversations_enabled', 'false');  // 是否启用密室对话
        params.append('krs_registration_enabled', 'true');  // 是否启用KRS注册
        params.append('cards_platform', 'Web-12');  // 卡片平台
        params.append('include_cards', '1');  // 包含卡片
        params.append('include_ext_alt_text', 'true');  // 包含扩展的Alt文本
        params.append('include_ext_limited_action_results', 'true');  // 包含扩展的有限操作结果
        params.append('include_quote_count', 'true');  // 包含引用计数
        params.append('include_reply_count', '1');  // 包含回复计数
        params.append('tweet_mode', 'extended');  // 推文模式
        params.append('include_ext_views', 'true');  // 包含扩展的查看次数
        params.append('dm_users', 'false');  // 是否启用DM用户
        params.append('include_groups', 'true');  // 包含组
        params.append('include_inbox_timelines', 'true');  // 包含收件箱时间线
        params.append('include_ext_media_color', 'true');  // 包含扩展的媒体颜色
        params.append('supports_reactions', 'true');  // 支持反应
        params.append('supports_edit', 'true');  // 支持编辑
        params.append('include_ext_edit_control', 'true');  // 包含扩展的编辑控制
        params.append('include_ext_business_affiliations_label', 'true');  // 包含扩展的业务关联标签
        params.append('ext', 'mediaColor,altText,businessAffiliationsLabel,mediaStats,highlightedLabel,parodyCommentaryFanLabel,voiceInfo,birdwatchPivot,superFollowMetadata,unmentionInfo,editControl,article');  // 扩展字段
        return params;
    }

    async getProfileByUserId(userId: string) {
        const url = `https://api.twitter.com/2/users?ids=${userId}`;
        const headers = await this.getheaders(this.auth);
        const response = await fetch(url, { headers: headers, });
        if (!response.ok) { throw new Error(`获取消息更新失败: ${response.statusText}`); }
        await updateCookieJar(this.auth.cookieJar(), response.headers);
        let data = await response.json()
        return data;
    }

    /**
     * 获取推文详情，包括推文内容和回复
     * @param tweetId 推文ID
     * @param rankingMode 回复排序模式，默认为"Relevance"
     * @returns 推文详情和回复
     */
    async getTweetDetail(
        tweetId: string,
        rankingMode: "Relevance" | "Latest" = "Relevance"
    ) {
        try {
            // GraphQL API端点
            const url = 'https://x.com/i/api/graphql/Ez6kRPyXbqNlhBwcNMpU-Q/TweetDetail';

            // 构建variables参数
            const variables = {
                focalTweetId: tweetId, // 要获取详情的目标推文ID
                with_rux_injections: false, // 是否包含RUX注入内容（如推广内容的特殊UI元素）
                rankingMode: rankingMode, // 回复排序模式："Relevance"（相关性）或"Latest"（最新）
                includePromotedContent: true, // 是否包含推广内容（广告）
                withCommunity: true, // 是否包含社区相关信息（如推文所属社区）
                withQuickPromoteEligibilityTweetFields: true, // 是否包含快速推广资格相关字段（用于商业账户）
                withBirdwatchNotes: true, // 是否包含社区笔记（Twitter的事实核查功能）
                withVoice: true // 是否包含语音相关数据（如语音推文）
            };

            // 构建features参数
            const features = {
                profile_label_improvements_pcf_label_in_post_enabled: true, // 启用个人资料标签改进，在帖子中显示PCF标签
                rweb_tipjar_consumption_enabled: true, // 启用网页版打赏功能的消费端
                responsive_web_graphql_exclude_directive_enabled: true, // 启用响应式Web GraphQL排除指令，优化查询
                verified_phone_label_enabled: false, // 禁用已验证电话号码标签显示
                creator_subscriptions_tweet_preview_api_enabled: true, // 启用创作者订阅推文预览API
                responsive_web_graphql_timeline_navigation_enabled: true, // 启用响应式Web GraphQL时间线导航功能
                responsive_web_graphql_skip_user_profile_image_extensions_enabled: false, // 不跳过用户个人资料图片扩展，加载完整图片
                premium_content_api_read_enabled: false, // 禁用高级内容API读取功能
                communities_web_enable_tweet_community_results_fetch: true, // 启用社区推文结果获取功能
                c9s_tweet_anatomy_moderator_badge_enabled: true, // 启用推文中显示版主徽章功能
                responsive_web_grok_analyze_button_fetch_trends_enabled: false, // 禁用Grok分析按钮获取趋势功能
                responsive_web_grok_analyze_post_followups_enabled: true, // 启用Grok分析帖子后续内容功能
                responsive_web_jetfuel_frame: false, // 禁用JetFuel框架功能
                responsive_web_grok_share_attachment_enabled: true, // 启用Grok分享附件功能
                articles_preview_enabled: true, // 启用文章预览功能
                responsive_web_edit_tweet_api_enabled: true, // 启用响应式Web编辑推文API
                graphql_is_translatable_rweb_tweet_is_translatable_enabled: true, // 启用GraphQL判断推文是否可翻译功能
                view_counts_everywhere_api_enabled: true, // 启用全局查看计数API
                longform_notetweets_consumption_enabled: true, // 启用长篇笔记推文消费功能
                responsive_web_twitter_article_tweet_consumption_enabled: true, // 启用响应式Web Twitter文章推文消费功能
                tweet_awards_web_tipping_enabled: false, // 禁用推文奖励网页打赏功能
                responsive_web_grok_analysis_button_from_backend: false, // 禁用从后端获取Grok分析按钮
                creator_subscriptions_quote_tweet_preview_enabled: false, // 禁用创作者订阅引用推文预览功能
                freedom_of_speech_not_reach_fetch_enabled: true, // 启用言论自由而非触达获取功能（内容审核相关）
                standardized_nudges_misinfo: true, // 启用标准化误导信息提示
                tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true, // 启用带可见性结果的推文优先使用GQL限制操作策略
                rweb_video_timestamps_enabled: true, // 启用网页版视频时间戳功能
                longform_notetweets_rich_text_read_enabled: true, // 启用长篇笔记推文富文本阅读功能
                longform_notetweets_inline_media_enabled: true, // 启用长篇笔记推文内联媒体功能
                responsive_web_grok_image_annotation_enabled: true, // 启用响应式Web Grok图像注释功能
                responsive_web_enhance_cards_enabled: false, // 禁用响应式Web增强卡片功能
                // 添加以下两个参数可能会提供更多对话数据
                interactive_text_enabled: true, // 启用交互式文本功能，支持推文中的交互元素
                responsive_web_text_conversations_enabled: true // 启用响应式Web文本对话功能，优化对话线程显示
            };

            // 构建fieldToggles参数
            const fieldToggles = {
                withArticleRichContentState: true,
                withArticlePlainText: false,
                withGrokAnalyze: false,
                withDisallowedReplyControls: false
            };

            // 构建URL参数
            const params = new URLSearchParams();
            params.set('variables', JSON.stringify(variables));
            params.set('features', JSON.stringify(features));
            params.set('fieldToggles', JSON.stringify(fieldToggles));

            // 获取认证头信息
            const headers = await this.getheaders(this.auth);

            // 发送请求
            const response = await fetch(`${url}?${params.toString()}`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`获取推文详情失败: ${response.statusText}`);
            }

            // 更新cookie
            await updateCookieJar(this.auth.cookieJar(), response.headers);

            // 解析响应数据
            const data = await response.json();

            return data;
        } catch (error) {
            console.error('获取推文详情时出错:', error);
            throw error;
        }
    }

    async getUserTweets(graphql_query: string, userId: string, set: any, count: number, cursor?: string) {
        const url = `https://x.com/i/api/graphql/${graphql_query}/UserTweets`;
        const params = new URLSearchParams();
        const variables = {
            userId: userId,                    // 用户ID
            count: count,                      // 获取推文数量
            includePromotedContent: true,      // 是否包含推广内容
            withQuickPromoteEligibilityTweetFields: true,  // 是否包含快速推广资格推文字段
            withVoice: true,                   // 是否包含语音内容
            withV2Timeline: true               // 是否使用V2时间线
        }
        if (cursor) {
            variables['cursor'] = cursor
        }

        params.set('variables', JSON.stringify(variables));
        params.set('features', JSON.stringify(features));
        params.set('fieldToggles', JSON.stringify(fieldToggles));
        params.set('timestamp', Date.now().toString());
        // 发送请求
        const headers = await this.getheaders(this.auth, 'OAuth2Session');
        const finalurl = `${url}?${params.toString()}`
        const response = await fetch(finalurl, { headers: headers, });
        if (!response.ok) { throw new Error(`获取消息更新失败: ${response.statusText}`); }
        await updateCookieJar(this.auth.cookieJar(), response.headers);
        // TODO: 解析数据并返回
        const data = await response.json();
        return await this.parse_usertweets(data, set);
    }

    async fetchTimeline(graphql_query: string, reqstr: string, set: any, count: number, cursor?: string): Promise<TimelineData> {
        const url = `https://x.com/i/api/graphql/${graphql_query}/${reqstr}`;
        const params = new URLSearchParams();

        const variables_data = {}
        variables_data['count'] = count
        variables_data['includePromotedContent'] = true
        variables_data['latestControlAvailable'] = true
        if (cursor) {
            variables_data['cursor'] = cursor
        } else {
            variables_data['requestContext'] = 'launch'
        }

        params.set('variables', JSON.stringify(variables_data));
        params.set('features', JSON.stringify(features));
        params.set('queryId', graphql_query);

        const headers = await this.getheaders(this.auth, 'OAuth2Session');
        const finalurl = `${url}?${params.toString()}`
        const response = await fetch(finalurl, { headers: headers, });
        if (!response.ok) { throw new Error(`获取消息更新失败: ${response.statusText}`); }
        await updateCookieJar(this.auth.cookieJar(), response.headers);
        const data = await response.json();
        return await this.parse_timeline(data, set);
    }

    private async handle_tweets(tweets: TweetData[], set: any) {
        for (const tweet of tweets) {
            if (set.tco) tweet.text = await utils.replace_tcos(tweet.text)
            if (set.image_describ) {
                const media_describs = await utils.get_image_description(tweet.media)
                tweet.media_description = media_describs.map(m => `${m.title}:${m.description}`).join('|')
            }
        }
    }

    private async parse_usertweets(data: any, set: any): Promise<TimelineData> {
        const instructions = data?.data?.user?.result?.timeline_v2?.timeline?.instructions;
        if (!instructions || !Array.isArray(instructions)) {
            const timelineData: TimelineData = { tweets: [], users: [] };
            return timelineData;
        } else {
            const ret = await this.parse_data(instructions);
            await this.handle_tweets(ret.tweets, set)
            return ret
        }
    }

    private async parse_timeline(data: any, set: any): Promise<TimelineData> {
        // 检查并获取指令数组
        const instructions = data?.data?.home?.home_timeline_urt?.instructions;
        if (!instructions || !Array.isArray(instructions)) {
            const timelineData: TimelineData = { tweets: [], users: [] };
            return timelineData;
        } else {
            const ret = await this.parse_data(instructions);
            await this.handle_tweets(ret.tweets, set)
            return ret
        }
    }

    // 解析时间线数据的函数
    private parse_data(instructions: any): TimelineData {
        const timelineData: TimelineData = {
            tweets: [],
            users: []
        }
        // 遍历指令
        for (const instruction of instructions) {
            // 处理添加条目的指令
            if (instruction.type === "TimelineAddEntries") {
                for (const entry of instruction.entries) {
                    // 处理游标
                    if (entry.content?.entryType === "TimelineTimelineCursor") {
                        if (entry.content.cursorType === "Top") {
                            timelineData.top_cursor = entry.content.value;
                        } else if (entry.content.cursorType === "Bottom") {
                            timelineData.bottom_cursor = entry.content.value;
                        }
                        continue;
                    }

                    // 处理推文
                    if (entry.content?.itemContent?.tweet_results?.result) {
                        const tweetResult = entry.content.itemContent.tweet_results.result;
                        const tweet_user = this.parseTweet(tweetResult);
                        if (tweet_user) {
                            timelineData.tweets.push(tweet_user.tweet);
                            timelineData.users.push(tweet_user.user);
                        }
                    }
                }
            }
        }

        return timelineData;
    }

    // 解析单条推文的辅助函数
    private parseTweet(tweetData: any): { user: UserData; tweet: TweetData } | null {
        if (!tweetData || !tweetData.legacy) return null;

        const legacy = tweetData.legacy;
        const user = tweetData.core?.user_results?.result?.legacy;

        if (!user) return null;

        const userData: UserData = {
            id: tweetData.core.user_results.result.rest_id,
            username: user.screen_name,
            screenname: user.name,
            profile_image_url: user.profile_image_url_https,
            tweet_count: user.statuses_count,
            follower_count: user.followers_count,
            following_count: user.friends_count,
            description: user.description,
            created_at: new Date(user.created_at).getTime(),
            last_update: Date.now()
        }

        // 媒体
        const medias = []
        for (const media of legacy.entities?.media ?? []) {
            if (media.type === 'photo' || media.type === 'animated_gif')
                medias.push(media.media_url_https)
        }

        // 推文
        const tweetdata: TweetData = {
            id: legacy.id_str,
            text: legacy.full_text || legacy.text,
            created_at: new Date(legacy.created_at).getTime(),
            userId: tweetData.core.user_results.result.rest_id,
            retweet_count: legacy.retweet_count,
            reply_count: legacy.reply_count,
            like_count: legacy.favorite_count,
            quote_count: legacy.quote_count,
            view_count: legacy.view_count,
            bookmark_count: legacy.bookmark_count,
            hashtags: legacy.entities.hashtags.map((hashtag: any) => hashtag.text), //话题标签
            user_mentions: legacy.entities.user_mentions.map((mention: any) => mention.screen_name), //提及用户
            media: medias, //媒体
            media_description: '', //媒体描述
            retweet_id: legacy.retweeted_status_result?.result?.legacy?.id_str, //转推原文ID
            quted_tweet_id: legacy.is_quote_status ? legacy.quoted_status_id_str : undefined, //引用推文ID
            lang: legacy.lang
        }

        return {
            user: userData,
            tweet: tweetdata
        };
    }

    async fetchFollowers(graphql_query: string, reqstr: string, userId: string, count: number, cursor?: string): Promise<FollowersData> {
        const url = `https://x.com/i/api/graphql/${graphql_query}/${reqstr}`;
        const params = new URLSearchParams();

        const variables_data: any = {
            userId: userId,
            count: count,
            includePromotedContent: false // 根据 request.json 设置为 false
        };
        if (cursor) {
            variables_data['cursor'] = cursor;
        }

        params.set('variables', JSON.stringify(variables_data));
        params.set('features', JSON.stringify(follow_features));

        const headers = await this.getheaders(this.auth, 'OAuth2Session');
        const finalurl = `${url}?${params.toString()}`;

        // console.log(`Fetching followers from: ${finalurl}`); // 添加日志方便调试

        const response = await fetch(finalurl, { headers: headers });

        if (!response.ok) {
            console.error(`获取关注者失败: ${response.status} ${response.statusText}`);
            // 可以尝试读取 response body 获取更详细的错误信息
            try {
                const errorBody = await response.text();
                console.error("Error Body:", errorBody);
            } catch (e) {
                console.error("无法读取错误响应体:", e);
            }
            throw new Error(`获取关注者失败: ${response.statusText}`);
        }

        await updateCookieJar(this.auth.cookieJar(), response.headers);
        const data = await response.json();

        // 调用新的解析函数
        return this.parse_followers(data);
    }

    // 新增: 解析关注者列表响应的函数
    private parse_followers(data: any): FollowersData {
        const users: User[] = [];
        let nextCursor: string | undefined = undefined;

        try {
            // console.log('原始数据结构:', JSON.stringify(data?.data?.user?.result?.timeline?.timeline?.instructions, null, 2));
            const instructions = data?.data?.user?.result?.timeline?.timeline?.instructions;
            if (!instructions || !Array.isArray(instructions)) {
                console.warn("未找到 instructions 或格式不正确:", data);
                return { users, nextCursor };
            }

            for (const instruction of instructions) {
                // console.log('处理指令:', instruction.type);
                // 处理添加用户的指令
                if (instruction.type === 'TimelineAddEntries' && instruction.entries) {
                    for (const entry of instruction.entries) {
                        // console.log('处理条目:', entry.content?.entryType);
                        if (entry.content?.entryType === 'TimelineTimelineItem' && entry.content?.itemContent?.__typename === 'TimelineUser') {
                            const userResult = entry.content.itemContent.user_results?.result;
                            if (userResult && userResult.__typename === 'User') {
                                const legacy = userResult.legacy;
                                if (legacy) {
                                    users.push({
                                        id: userResult.rest_id,
                                        username: legacy.screen_name,
                                        screenname: legacy.name,
                                        description: legacy.description,
                                        followers_count: legacy.followers_count,
                                        following_count: legacy.friends_count
                                    });
                                }
                            }
                        }
                        // 处理分页 Cursor
                        else if (entry.content?.entryType === 'TimelineTimelineCursor' && entry.content?.cursorType === 'Bottom') {
                            // console.log('找到Bottom Cursor:', entry.content.value);
                            nextCursor = entry.content.value;
                        }
                    }
                }
                // 处理单独的 Cursor 指令 (以防万一)
                else if (instruction.type === 'TimelineUpdateEntries' && instruction.entries) {
                    for (const entry of instruction.entries) {
                        if (entry.content?.entryType === 'TimelineTimelineCursor' && entry.content?.cursorType === 'Bottom') {
                            // console.log('找到UpdateEntries Bottom Cursor:', entry.content.value);
                            nextCursor = entry.content.value;
                        }
                    }
                }
            }
        } catch (error) {
            console.error("解析关注者数据时出错:", error, "原始数据:", data);
        }

        // console.log(`解析完成: 找到 ${users.length} 个关注者, 下一页 Cursor: ${nextCursor}`);
        return { users, nextCursor };
    }

    async listener3(
        userId: string,
        events: StreamEvents
    ) {
        const url = 'https://twitter.com/i/api/1.1/dm/user_updates.json';
        const messageListenUrl = `https://api.twitter.com/1.1/live_pipeline/events`;

        const abortController = new AbortController();


        const cookiejar = await this.auth.cookieJar()
        const cookies = await cookiejar.getCookies(url);
        const xCsrfToken = cookies.find((cookie) => cookie.key === 'ct0');
        let cookiestr = await cookiejar.getCookieString(url);
        cookiestr += `twid=u%3D${userId};`;
        const headers = {
            authorization: `Bearer ${this.auth.bearerToken}`,
            cookie: cookiestr,
            'content-type': 'text/event-stream',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36',
            'x-guest-token': this.auth.guestToken,
            'x-twitter-auth-type': 'OAuth2Client',
            'x-twitter-active-user': 'yes',
            'x-csrf-token': xCsrfToken?.value as string,
            'X-Client-Transaction-Id': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            'Connection': 'keep-alive',
        };
        // 使用自定义fetch实现来设置headers
        const eventSource = new EventSource(messageListenUrl, {
            fetch: (input, init?: FetchLikeInit) => {
                return fetch(input, {
                    ...init,
                    headers: {
                        ...init?.headers,
                        ...headers
                    },
                    signal: abortController.signal
                });
            }
        });

        let session_id: string | undefined;

        // 监听消息事件
        eventSource.onmessage = async (event) => {
            try {
                console.log('收到消息:', event.data);
                const data = JSON.parse(event.data);
                if (data.topic === '/system/config') {
                    session_id = data.payload.config?.session_id
                } else {
                    // console.log('收到消息:', data);
                    await events.onMessage(data);
                }
            } catch (error) {
                await events.onError?.(error instanceof Error ? error : new Error(`解析消息失败: ${String(error)}`));
            }
        };

        // 监听错误事件
        eventSource.onerror = async (error) => {
            console.error('EventSource错误:', error);
            // await events.onError?.(error instanceof Error ? error : new Error(`EventSource错误: ${String(error)}`));
            await events.onError?.(error instanceof Error ? error : new Error(`监听消息失败: ${String(error)}`));
        };

        while (session_id === undefined) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 返回中止控制器，以便调用者可以在需要时关闭连接
        return {
            abort: () => {
                eventSource.close();
                abortController.abort();
            },
            sessionId: session_id
        };
    }

    async user_updates(
        cursor?: string
    ): Promise<upresponse> {
        const url = 'https://x.com/i/api/1.1/dm/user_updates.json';
        const params = this.get_update_user_params();
        if (cursor) { params.append('cursor', cursor); }
        
        const maxRetries = 3;
        let retryCount = 0;
        let lastError;
        
        while (retryCount < maxRetries) {
            try {
                const headers = await this.getheaders(this.auth, 'OAuth2Session');
                const response = await fetch(`${url}?${params.toString()}`, { 
                    headers: headers,
                    signal: AbortSignal.timeout(15000) // 15秒超时
                });
                
                if (!response.ok) { throw new Error(`获取消息更新失败: ${response.statusText}`); }
                await updateCookieJar(this.auth.cookieJar(), response.headers);
                let data = await response.json()
                const ret = this.parse_user_updates(data);
                return ret;
            } catch (error) {
                lastError = error;
                retryCount++;
                
                // 网络错误时才重试
                if (error.code === 'ECONNRESET' || 
                    error.name === 'AbortError' || 
                    error.message.includes('fetch failed')) {
                    console.log(`网络连接错误，正在进行第 ${retryCount} 次重试...`);
                    // 指数退避策略，每次重试等待时间增加
                    await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                } else {
                    // 其他错误直接抛出
                    throw error;
                }
            }
        }
        
        // 所有重试都失败了
        console.error(`获取消息更新失败，已重试 ${maxRetries} 次`, lastError);
        throw lastError;
    }

    async sendTyping(
        conversation_id: string
    ) {

        const queryId = "HL96-xZ3Y81IEzAdczDokg"
        const eventUrl = `https://x.com/i/api/graphql/${queryId}/useTypingNotifierMutation`;

        const payload = {
            variables: { conversationId: conversation_id },
            queryId: queryId
        };

        const headers = await this.getheaders(this.auth);
        headers.set('x-twitter-auth-type', 'OAuth2Session');

        const response = await fetch(eventUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
        });
        const ret = await response.json();
        return ret;
    }

    async updateSubscriptions(
        subscribeTopics: string[] = [],
        unsubscribeTopics: string[] = [],
        sessionId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {

            console.log('更新订阅...',subscribeTopics,unsubscribeTopics);

            const url = 'https://api.twitter.com/1.1/live_pipeline/update_subscriptions';

            const headers = await this.getheaders(this.auth);
            headers.set('content-type', 'application/x-www-form-urlencoded');
            headers.set('x-twitter-auth-type', 'OAuth2Session');
            headers.set('x-client-transaction-id', `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
            headers.set('livepipeline-session', sessionId);

            // 构建请求体
            const formData = new URLSearchParams();

            if (subscribeTopics.length > 0) {
                formData.append('sub_topics', subscribeTopics.join(','));
            }

            if (unsubscribeTopics.length > 0) {
                formData.append('unsub_topics', unsubscribeTopics.join(','));
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`更新订阅失败: ${response.statusText}\n${errorText}`);
            }

            await updateCookieJar(this.auth.cookieJar(), response.headers);

            const data = await response.json();

            // 检查响应中是否有错误
            if (data.subscriptions?.errors && data.subscriptions.errors.length > 0) {
                return {
                    success: false,
                    error: `订阅错误: ${JSON.stringify(data.subscriptions.errors)}`
                };
            }

            return {
                success: true,
                error: sessionId
            };
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    parse_user_updates(data: any): upresponse {
        if ("inbox_initial_state" in data) {
            data = data["inbox_initial_state"]
        } else if ("user_events" in data) {
            data = data["user_events"]
        }

        const ret: upresponse = {
            cursor: data.cursor,
            conversations: {}
        }

        if (!data.entries) {
            // console.log(JSON.stringify(data, null, 2));
            return ret;
        };

        const users: Record<string, any> = {};
        Object.values(data.users).forEach((item: any) => {
            users[item.id_str] = item;
        })

        Object.values(data.entries).forEach((message: any) => {
            if (!message.message) {
                // console.log("parse_user_updates no message:",JSON.stringify(message, null, 2));
                return;
            }
            try {
                const conversationId = message.message.conversation_id;
                if (!ret.conversations[conversationId]) {
                    ret.conversations[conversationId] = {
                        // conversationId:conversationId,
                        messages: []
                    }
                }

                ret.conversations[conversationId].messages.push({
                    id: message.message.id,
                    timestamp: message.message.message_data.time,
                    conversationId: conversationId,
                    senderId: message.message.message_data.sender_id,
                    recipientId: message.message.message_data.recipient_id,
                    senderScreenName: users[message.message.message_data.sender_id]?.name,
                    recipientScreenName: users[message.message.message_data.recipient_id]?.name,
                    mediaUrls: [],
                    text: message.message.message_data.text,
                });
            } catch (e) {
                console.log("parse_user_updates 解析失败", e, JSON.stringify(message, null, 2))
            }
        });
        //sort messages
        for (const conversation of Object.values(ret.conversations)) {
            conversation.messages.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
        }

        return ret
    }

    async sendDirectMessage(
        conversation_id: string,
        text: string,
    ): Promise<Message | undefined> {

        const messageDmUrl = 'https://x.com/i/api/1.1/dm/new2.json';

        const request_id = crypto.randomUUID();
        const payload = {
            conversation_id: `${conversation_id}`,
            recipient_ids: false,
            text: text,
            cards_platform: 'Web-12',
            include_cards: 1,
            include_quote_count: true,
            dm_users: false,
            request_id
        };

        const response = await fetch(messageDmUrl, {
            method: 'POST',
            headers: await this.getheaders(this.auth),
            body: JSON.stringify(payload),
        });

        await updateCookieJar(this.auth.cookieJar(), response.headers);

        if (!response.ok) {
            throw new Error(await response.text());
        }

        let messageId: string | undefined;
        const data = await response.json();
        for (const messagedata of data.entries) {
            if (messagedata.message.request_id == request_id) {
                messageId = messagedata.message.id;
            }
        }
        const upresponse = this.parse_user_updates(data);
        const allMessages = Object.values(upresponse.conversations).flatMap(conversation => conversation.messages);

        // 修复：forEach中的return只会从当前回调函数返回，不会从整个方法返回
        // 使用find方法找到匹配的消息并返回
        const foundMessage = allMessages.find(message => message.id === messageId);
        if (foundMessage) {
            return foundMessage;
        }

        return undefined;
    }
}