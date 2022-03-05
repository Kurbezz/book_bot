import { AuthorBook, TranslatorBook, Book, Author, Sequence, BookAuthor } from './services/book_library';


type AllBookTypes = Book | AuthorBook | TranslatorBook;


function isAuthorBook(item: AllBookTypes): item is AuthorBook {
    return 'translator' in item;
}


function isTranslatorBook(item: AllBookTypes): item is TranslatorBook {
    return 'authors' in item;
}


export function formatBook(book: AllBookTypes, short: boolean = false): string {
    let response: string[] = [];

    response.push(`📖 ${book.title} | ${book.lang}`);

    // if (book.annotation_exists) {
    //     response.push(`📝 Аннотация: /b_an_${book.id}`)
    // }

    if (isTranslatorBook(book) && book.authors.length > 0) {
        response.push('Авторы:')

        const pushAuthor = (author: BookAuthor) => response.push(`͏👤 ${author.last_name} ${author.first_name} ${author.middle_name}`);

        if (short && book.authors.length >= 5) {
            book.authors.slice(0, 5).forEach(pushAuthor);
            response.push("  и другие.");
        } else {
            book.authors.forEach(pushAuthor);
        }
    }

    if (isAuthorBook(book) && book.translators.length > 0) {
        response.push('Переводчики:');

        const pushTranslator = (author: BookAuthor) => response.push(`͏👤 ${author.last_name} ${author.first_name} ${author.middle_name}`);

        if (short && book.translators.length >= 5) {
            book.translators.slice(0, 5).forEach(pushTranslator);
            response.push("  и другие.")
        } else {
            book.translators.forEach(pushTranslator);
        }
    }

    book.available_types.forEach(a_type => response.push(`📥 ${a_type}: /d_${a_type}_${book.id}`));

    return response.join('\n');
}

export function formatBookShort(book: AllBookTypes): string {
    return formatBook(book, true);
}


export function formatAuthor(author: Author): string {
    let response = [];

    response.push(`👤 ${author.last_name} ${author.first_name} ${author.middle_name}`);
    response.push(`/a_${author.id}`);

    // if (author.annotation_exists) {
    //     response.push(`📝 Аннотация: /a_an_${author.id}`);
    // }

    return response.join('\n');
}


export function formatTranslator(author: Author): string {
    let response = [];

    response.push(`👤 ${author.last_name} ${author.first_name} ${author.middle_name}`);
    response.push(`/t_${author.id}`);

    // if (author.annotation_exists) {
    //     response.push(`📝 Аннотация: /a_an_${author.id}`);
    // }

    return response.join('\n');
}


export function formatSequence(sequence: Sequence): string {
    let response = [];

    response.push(`📚 ${sequence.name}`);
    response.push(`/s_${sequence.id}`);

    return response.join('\n');
}
