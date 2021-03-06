import { Context } from 'telegraf';

import { clearBookCache, getBookCache, downloadFromCache } from '../services/book_cache';
import { getBookCacheBuffer } from '../services/book_cache_buffer';
import { BotState, Cache } from '@/bots/manager/types';


async function _sendFile(ctx: Context, state: BotState, chatId: number, id: number, format: string) {
    const sendWithDownloadFromChannel = async () => {
        const data = await downloadFromCache(id, format);

        if (data === null) {
            await ctx.reply("Ошибка скачивания книги. Попробуйте позже");
            return
        }

        await ctx.telegram.sendDocument(chatId, { source: data.source, filename: data.filename }, { caption: data.caption });
    }

    const getCachedMessage = async () => {
        if (state.cache === Cache.ORIGINAL) {
            return getBookCache(id, format);
        }

        return getBookCacheBuffer(id, format);
    };

    const sendCached = async () => {
        const cache = await getCachedMessage();
        await ctx.telegram.copyMessage(chatId, cache.chat_id, cache.message_id, {
            allow_sending_without_reply: true,
        });
    };

    if (state.cache === Cache.NO_CACHE) {
        return sendWithDownloadFromChannel();
    }

    try {
        return await sendCached();
    } catch (e) {
        await clearBookCache(id, format);
        return sendCached();
    }
}


export async function sendFile(ctx: Context, state: BotState) {
    if (!ctx.message || !('text' in ctx.message)) {
        return;
    }

    const [_, format, id] = ctx.message.text.split('@')[0].split('_');
    const chatId = ctx.message.chat.id;

    const sendSendingAction = async () => {
        await ctx.telegram.sendChatAction(chatId, "upload_document");
    }
    const action = setInterval(() => sendSendingAction(), 5000);

    try {
        sendSendingAction();
        return await _sendFile(ctx, state, chatId, parseInt(id), format);
    } catch (e) {
        await ctx.reply("Ошибка! Попробуйте позже :(", {
            reply_to_message_id: ctx.message.message_id,
        });
        throw e;
    } finally {
        clearInterval(action);
    }
}
