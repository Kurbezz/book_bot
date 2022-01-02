import { Context, Telegraf, Markup, TelegramError } from 'telegraf';

import { BotState, Cache } from '@/bots/manager';

import env from '@/config';

import * as Messages from "./messages";

import * as CallbackData from "./callback_data";

import * as BookLibrary from "./services/book_library";
import { CachedMessage, getBookCache } from './services/book_cache';
import { getBookCacheBuffer } from './services/book_cache_buffer';
import { download } from './services/downloader';
import { createOrUpdateUserSettings } from './services/user_settings';
import { formatBook, formatAuthor, formatSequence } from './format';
import { getPaginatedMessage, registerPaginationCommand, registerRandomItemCallback } from './utils';
import { getRandomKeyboard } from './keyboard';


export async function createApprovedBot(token: string, state: BotState): Promise<Telegraf> {
    const bot = new Telegraf(token, {
        telegram: {
            apiRoot: env.TELEGRAM_BOT_API_ROOT,
        }
    });

    async function setMyCommands() {
        await bot.telegram.setMyCommands([
            {command: "random", description: "Попытать удачу"},
            {command: "update_log", description: "Информация об обновлении каталога"},
            {command: "settings", description: "Настройки"},
            {command: "help", description: "Помощь"},
        ]);
    }

    try {
        await setMyCommands();
    } catch (e: unknown) {
        if (e instanceof TelegramError && e.response.error_code === 429) {
            setTimeout(() => setMyCommands(), 1000 * (e.response.parameters?.retry_after || 5));
        }
    }

    bot.use(async (ctx: Context, next) => {
        if (ctx.from) {
            const user = ctx.from;
            createOrUpdateUserSettings({
                user_id: user.id,
                last_name: user.last_name || '',
                first_name: user.first_name,
                username: user.username || '',
                source: ctx.botInfo.username,
            });
        }
        await next();
    });

    bot.help((ctx: Context) => ctx.reply(Messages.HELP_MESSAGE));

    bot.start((ctx: Context) => {
        if (!ctx.message) {
            return;
        }

        const name = ctx.message.from.first_name || ctx.message.from.username || 'пользователь';
        ctx.telegram.sendMessage(ctx.message.chat.id,
            Messages.START_MESSAGE.replace('{name}', name), {
                reply_to_message_id: ctx.message.message_id,
            }
        );
    });

    registerPaginationCommand(bot, CallbackData.SEARCH_BOOK_PREFIX, BookLibrary.searchByBookName, formatBook);
    registerPaginationCommand(bot, CallbackData.SEARCH_AUTHORS_PREFIX, BookLibrary.searchAuthors, formatAuthor);
    registerPaginationCommand(bot, CallbackData.SEARCH_SERIES_PREFIX, BookLibrary.searchSequences, formatSequence);

    registerPaginationCommand(bot, CallbackData.AUTHOR_BOOKS_PREFIX, BookLibrary.getAuthorBooks, formatBook);
    registerPaginationCommand(bot, CallbackData.SEQUENCE_BOOKS_PREFIX, BookLibrary.getSequenceBooks, formatBook);

    bot.command("random", async (ctx: Context) => {
        ctx.reply("Что хотим получить?", {
            reply_markup: getRandomKeyboard().reply_markup
        })
    });

    registerRandomItemCallback(bot, CallbackData.RANDOM_BOOK, BookLibrary.getRandomBook, formatBook);
    registerRandomItemCallback(bot, CallbackData.RANDOM_AUTHOR, BookLibrary.getRandomAuthor, formatAuthor);
    registerRandomItemCallback(bot, CallbackData.RANDOM_SEQUENCE, BookLibrary.getRandomSequence, formatSequence);

    bot.hears(/^\/d_[a-zA-Z0-9]+_[\d]+$/gm, async (ctx: Context) => {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const [_, format, id] = ctx.message.text.split('_');

        let cache: CachedMessage;

        if (state.cache === Cache.ORIGINAL) {
            cache = await getBookCache(parseInt(id), format);
        } else if (state.cache === Cache.BUFFER) {
            cache = await getBookCacheBuffer(parseInt(id), format);
        } else {
            const book = await BookLibrary.getBookById(parseInt(id));
            const data = await download(book.source.id, book.remote_id, format);
            ctx.telegram.sendDocument(ctx.message.chat.id, data, {
                reply_to_message_id: ctx.message.message_id
            })
            return;
        }

        ctx.telegram.copyMessage(ctx.message.chat.id, cache.chat_id, cache.message_id, {
            allow_sending_without_reply: true,
        })
    });

    bot.hears(/^\/b_info_[\d]+$/gm, async (ctx: Context) => {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const bookId = ctx.message.text.split('_')[2];

        const annotation = await BookLibrary.getBookAnnotation(parseInt(bookId));

        ctx.reply(annotation.text);
    });

    bot.hears(/^\/a_[\d]+$/gm, async (ctx: Context) => {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const authorId = ctx.message.text.split('_')[1];

        const pMessage = await getPaginatedMessage(CallbackData.AUTHOR_BOOKS_PREFIX, authorId, 1, BookLibrary.getAuthorBooks, formatBook);

        await ctx.reply(pMessage.message, {
            reply_markup: pMessage.keyboard.reply_markup
        });
    });

    bot.hears(/^\/s_[\d]+$/gm, async (ctx: Context) => {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const sequenceId = ctx.message.text.split('_')[1];

        const pMessage = await getPaginatedMessage(CallbackData.SEQUENCE_BOOKS_PREFIX, sequenceId, 1, BookLibrary.getSequenceBooks, formatBook);

        await ctx.reply(pMessage.message, {
            reply_markup: pMessage.keyboard.reply_markup
        });
    });

    bot.on("message", async (ctx: Context) => {
        if (!ctx.message || !('text' in ctx.message)) {
            return;
        }

        const query = ctx.message.text.substring(0, 64 - 7);

        let keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('Книгу', `${CallbackData.SEARCH_BOOK_PREFIX}${query}_1`)
            ],
            [
                Markup.button.callback('Автора',  `${CallbackData.SEARCH_AUTHORS_PREFIX}${query}_1`),
            ],
            [
                Markup.button.callback('Серию', `${CallbackData.SEARCH_SERIES_PREFIX}${query}_1`)
            ],
            [
                Markup.button.callback('Переводчика', '# ToDO'),
            ]
        ]);

        await ctx.telegram.sendMessage(ctx.message.chat.id, Messages.SEARCH_MESSAGE, {
            reply_to_message_id: ctx.message.message_id,
            reply_markup: keyboard.reply_markup,
        });
    }); 

    return bot;
}