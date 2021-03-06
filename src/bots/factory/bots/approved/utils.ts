import { Context, Markup, Telegraf } from  'telegraf';
import { InlineKeyboardMarkup } from 'typegram';
import { URLSearchParams } from 'url';

import { isNotModifiedMessage } from './errors_utils';
import { getPaginationKeyboard, getUserAllowedLangsKeyboard } from './keyboard';
import * as BookLibrary from "./services/book_library";
import { createOrUpdateUserSettings, getUserOrDefaultLangCodes } from './services/user_settings';
import Sentry from '@/sentry';


interface PreparedMessage {
    message: string;
    keyboard?: Markup.Markup<InlineKeyboardMarkup>;
}


export async function getPaginatedMessage<T, D extends string | number>(
    prefix: string,
    data: D,
    page: number,
    allowedLangs: string[],
    itemsGetter: (data: D, page: number, allowedLangs: string[]) => Promise<BookLibrary.Page<T>>,
    itemFormater: (item: T) => string,
    header: string = "",
    noItemsMessage: string = "",
): Promise<PreparedMessage> {
    const itemsPage = await itemsGetter(data, page, allowedLangs);

    if (itemsPage.total_pages === 0) {
        return {
            message: noItemsMessage,
        }
    }

    if (page > itemsPage.total_pages) {
        return getPaginatedMessage(prefix, data, itemsPage.total_pages, allowedLangs, itemsGetter, itemFormater, header, noItemsMessage);
    }

    const formatedItems = itemsPage.items.map(itemFormater).join('\n\n\n');
    const message = header + formatedItems + `\n\nСтраница ${page}/${itemsPage.total_pages}`;

    const keyboard = getPaginationKeyboard(prefix, data, page, itemsPage.total_pages);

    return {
        message,
        keyboard
    };
} 


export function registerPaginationCommand<T, Q extends string | number>(
    bot: Telegraf,
    prefix: string,
    argsGetter: (ctx: Context) => { query: Q, page: number } | null,
    prefixCreator: ((query: Q) => string) | null,
    itemsGetter: (data: Q, page: number, allowedLangs: string[]) => Promise<BookLibrary.Page<T>>,
    itemFormater: (item: T) => string,
    headers?: string,
    noItemsMessage?: string,
) {
    bot.action(new RegExp(prefix), async (ctx: Context) => {
        if (!ctx.callbackQuery) return;

        const args = argsGetter(ctx);

        if (args === null) return;

        const { query, page } = args;

        const allowedLangs = await getUserOrDefaultLangCodes(ctx.callbackQuery.from.id);

        const tPrefix = prefixCreator ? prefixCreator(query) : prefix;

        const pMessage = await getPaginatedMessage(
            tPrefix, query, page, allowedLangs, itemsGetter, itemFormater, headers, noItemsMessage,
        );

        try {
            await ctx.editMessageText(pMessage.message, {
                reply_markup: pMessage.keyboard?.reply_markup
            });
        } catch (e) {
            if (!isNotModifiedMessage(e)) {
                Sentry.captureException(e);
            }
        }
    })
}

export function registerRandomItemCallback<T>(
    bot: Telegraf,
    callback_data: string,
    itemGetter: (allowedLangs: string[]) => Promise<T>,
    itemFormatter: (item: T) => string,
) {
    bot.action(callback_data, async (ctx: Context) => {
        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

        const item = await itemGetter(
            await getUserOrDefaultLangCodes(ctx.callbackQuery.from.id),
        );

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("Повторить?", callback_data)]
        ]);

        try {
            await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]).reply_markup);
        } catch (e) {}

        ctx.reply(itemFormatter(item), {
            reply_markup: keyboard.reply_markup,
        });
    });
}


export function registerLanguageSettingsCallback(
    bot: Telegraf,
    action: 'on' | 'off',
    prefix: string,
) {
    bot.action(new RegExp(prefix), async (ctx: Context) => {
        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

        let allowedLangsCodes = await getUserOrDefaultLangCodes(ctx.callbackQuery.from.id);

        const tLang = ctx.callbackQuery.data.split("_")[2];

        if (action === 'on') {
            allowedLangsCodes.push(tLang);
        } else {
            allowedLangsCodes = allowedLangsCodes.filter((item) => item !== tLang);
        }

        if (allowedLangsCodes.length === 0) {
            ctx.answerCbQuery("Должен быть активен, хотя бы один язык!", {
                show_alert: true,
            });
            return;
        }

        const user = ctx.callbackQuery.from;
        await createOrUpdateUserSettings({
            user_id: user.id,
            last_name: user.last_name || '',
            first_name: user.first_name,
            username: user.username || '',
            source: ctx.botInfo.username,
            allowed_langs: allowedLangsCodes,
        });

        const keyboard = await getUserAllowedLangsKeyboard(user.id);

        try {
            await ctx.editMessageReplyMarkup(keyboard.reply_markup);
        } catch {}
    });
}

export function getAllowedLangsSearchParams(allowedLangs: string[]): URLSearchParams {
    const sp = new URLSearchParams();
    allowedLangs.forEach((lang) => sp.append('allowed_langs', lang));
    return sp;
}


const fail = (ctx: Context) => ctx.reply("Ошибка! Повторите поиск :(");


export function getSearchArgs(ctx: Context): { query: string, page: number } | null {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        fail(ctx)
        return null;
    }
    if (!ctx.callbackQuery.message || !('reply_to_message' in ctx.callbackQuery.message)) {
        fail(ctx);
        return null;
    }

    if (!ctx.callbackQuery.message.reply_to_message || !('text' in ctx.callbackQuery.message.reply_to_message)) {
        fail(ctx)
        return null;
    }

    const page = parseInt(ctx.callbackQuery.data.split('_')[1]);

    if (isNaN(page)) {
        fail(ctx)
        return null;
    }

    const query = ctx.callbackQuery.message.reply_to_message.text
        .replaceAll("/", "");

    return { query, page };
}

export function getCallbackArgs(ctx: Context): { query: string, page: number} | null {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        fail(ctx)
        return null;
    }

    const [ _, query, sPage ] = ctx.callbackQuery.data.split('_');

    const page = parseInt(sPage);

    if (isNaN(page)) {
        fail(ctx)
        return null;
    }

    return { query, page };
}

export function getPrefixWithQueryCreator(prefix: string) {
    return (query: string) => `${prefix}${query}_`; 
}

export function isNormalText(value: string | null): boolean {
    if (value === null) return false;
    if (value.length === 0) return false;
    if (value.replaceAll("\n", "").replaceAll(" ", "").length === 0) return false;

    return true;
}
