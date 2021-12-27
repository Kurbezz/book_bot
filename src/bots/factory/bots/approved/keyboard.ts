import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'typegram';

import { RANDOM_BOOK, RANDOM_AUTHOR, RANDOM_SEQUENCE } from './callback_data';


export function getPaginationKeyboard(prefix: string, query: string, page: number, totalPages: number): Markup.Markup<InlineKeyboardMarkup> {
    function getRow(delta: number) {
        const row = [];

        if (page - delta > 0) {
            row.push(Markup.button.callback(`-${delta}`, `${prefix}${query}_${page - delta}`));
        }
        if (page + delta <= totalPages) {
            row.push(Markup.button.callback(`+${delta}`, `${prefix}${query}_${page + delta}`));
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


export function getRandomKeyboard(): Markup.Markup<InlineKeyboardMarkup> {
    return Markup.inlineKeyboard([
        [Markup.button.callback('Книгу', RANDOM_BOOK)],
        [Markup.button.callback('Автора', RANDOM_AUTHOR)],
        [Markup.button.callback('Серию', RANDOM_SEQUENCE)],
    ]);
}
