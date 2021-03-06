import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'typegram';
import moment from 'moment';
import chunkText from 'chunk-text';

import { RANDOM_BOOK, RANDOM_AUTHOR, RANDOM_SEQUENCE, ENABLE_LANG_PREFIX, DISABLE_LANG_PREFIX, UPDATE_LOG_PREFIX, RATE_PREFIX, RANDOM_BOOK_BY_GENRE, RANDOM_BOOK_BY_GENRE_REQUEST } from './callback_data';
import { getLanguages, getUserOrDefaultLangCodes } from './services/user_settings';
import * as BookRating from "./services/book_ratings";


function getButtonLabel(delta: number, direction: 'left' | 'right'): string {
    if (delta == 1) {
        return direction === 'left' ? "<" : ">";
    }

    return direction === 'left' ? `< ${delta} <` : `> ${delta} >`;
}


export function getPaginationKeyboard(prefix: string, query: string | number, page: number, totalPages: number): Markup.Markup<InlineKeyboardMarkup> {
    function getRow(delta: number) {
        const row = [];

        if (page - delta > 0) {
            row.push(Markup.button.callback(getButtonLabel(delta, 'left'), `${prefix}${page - delta}`));
        }
        if (page + delta <= totalPages) {
            row.push(Markup.button.callback(getButtonLabel(delta, 'right'), `${prefix}${page + delta}`));
        }

        return row;
    }

    const rows = [];

    const row1 = getRow(1);
    if (row1) {
        rows.push(row1);
    }

    const row5 = getRow(5);
    if (row5) {
        rows.push(row5);
    }

    return Markup.inlineKeyboard(rows);
}


export function getTextPaginationData(prefix: string, text: string, currentPage: number): {current: string, keyboard: Markup.Markup<InlineKeyboardMarkup>} {
    const chunks = chunkText(text, 512).filter((chunk) => chunk.length !== 0);

    const current = chunks[currentPage];

    const row = [];

    if (currentPage - 1 >= 0) {
        row.push(Markup.button.callback("<", `${prefix}_${currentPage - 1}`));
    }

    if (currentPage + 1 < chunks.length) {
        row.push(Markup.button.callback(">", `${prefix}_${currentPage + 1}`));
    }

    const keyboard = Markup.inlineKeyboard([row]);

    return {
        current,
        keyboard,
    }
}


export function getRandomKeyboard(): Markup.Markup<InlineKeyboardMarkup> {
    return Markup.inlineKeyboard([
        [Markup.button.callback('??????????', RANDOM_BOOK)],
        [Markup.button.callback('?????????? ???? ??????????', RANDOM_BOOK_BY_GENRE_REQUEST)],
        [Markup.button.callback('????????????', RANDOM_AUTHOR)],
        [Markup.button.callback('??????????', RANDOM_SEQUENCE)],
    ]);
}


export function getUpdateLogKeyboard(): Markup.Markup<InlineKeyboardMarkup> {
    const format = "YYYY-MM-DD";

    const now = moment().format(format);
    const d3 = moment().subtract(3, 'days').format(format);
    const d7 = moment().subtract(7, 'days').format(format);
    const d30 = moment().subtract(30, 'days').format(format);

    return Markup.inlineKeyboard([
        [Markup.button.callback('???? 3 ??????', `${UPDATE_LOG_PREFIX}${d3}_${now}_1`)],
        [Markup.button.callback('???? 7 ????????', `${UPDATE_LOG_PREFIX}${d7}_${now}_1`)],
        [Markup.button.callback('???? 30 ????????', `${UPDATE_LOG_PREFIX}${d30}_${now}_1`)],
    ]);
}

export async function getUserAllowedLangsKeyboard(userId: number): Promise<Markup.Markup<InlineKeyboardMarkup>> {
    const allLangs = await getLanguages();
    const userAllowedLangsCodes = await getUserOrDefaultLangCodes(userId);

    const onEmoji = '????';
    const offEmoji = '????';

    return Markup.inlineKeyboard([
        ...allLangs.map((lang) => {
            let titlePrefix: string;
            let callbackDataPrefix: string;
            if (userAllowedLangsCodes.includes(lang.code)) {
                titlePrefix = onEmoji;
                callbackDataPrefix = DISABLE_LANG_PREFIX;
            } else {
                titlePrefix = offEmoji;
                callbackDataPrefix = ENABLE_LANG_PREFIX;
            }
            const title = `${titlePrefix} ${lang.label}`;
            return [Markup.button.callback(title, `${callbackDataPrefix}${lang.code}`)];
        })
    ]);
}

export async function getRatingKeyboard(userId: number, bookId: number, rating: BookRating.Rating | null): Promise<Markup.Markup<InlineKeyboardMarkup>> {
    const bookRating = rating ? rating : await BookRating.get(userId, bookId);

    const rate = bookRating ? bookRating.rate : null;

    return Markup.inlineKeyboard([
        [1, 2, 3, 4, 5].map((bRate) => {
            const title = bRate === rate ? `?????? ${bRate}` : bRate.toString();

            return Markup.button.callback(title, `${RATE_PREFIX}${userId}_${bookId}_${bRate}`);
        })
    ]);
}
