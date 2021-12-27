import { cleanEnv, str, num } from 'envalid';


export default cleanEnv(process.env, {
    WEBHOOK_BASE_URL: str(),
    WEBHOOK_PORT: num(),
    TELEGRAM_BOT_API_ROOT: str({ default: "https://api.telegram.org" }),
    MANAGER_URL: str(),
    MANAGER_API_KEY: str(),
    BOOK_SERVER_URL: str(),
    BOOK_SERVER_API_KEY: str(),
    CACHE_SERVER_URL: str(),
    CACHE_SERVER_API_KEY: str(),
    BUFFER_SERVER_URL: str(),
    BUFFER_SERVER_API_KEY: str(),
    DOWNLOADER_URL: str(),
    DOWNLOADER_API_KEY: str(),
});
