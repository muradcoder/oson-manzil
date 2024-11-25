const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config(); 

// Telegram bot tokeningizni bu yerga kiriting
const token = process.env.TOKEN; 
const bot = new TelegramBot(token, { polling: true });

// Yandex Maps'da qidiruv uchun funksiya
async function searchAddressOnYandex(userInput) {
    const browser = await puppeteer.launch({
        headless: true, // Brauzerni ko'rinmaydigan rejimda ishga tushirish
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Serverda ishlatishda kerak
    });
    const page = await browser.newPage();

    try {
        // Yandex Maps saytiga o'tish
        await page.goto('https://yandex.uz/maps/21947/navoi/', { waitUntil: 'load', timeout: 60000 });

        // Manzilni inputga kiritish
        const searchInputSelector = 'input.input__control';
        await page.waitForSelector(searchInputSelector, { timeout: 15000 });
        await page.type(searchInputSelector, userInput, { delay: 100 });

        // Qidiruv tugmasini bosish
        await page.waitForSelector('button._view_search._size_medium', { timeout: 15000 });
        await page.click('button._view_search._size_medium');
        console.log('Qidiruv bosildi, natija yuklanmoqda...');

        // Koordinatalarni olish
        await page.waitForSelector('.toponym-card-title-view__coords-badge', { timeout: 30000 });
        const cordinats = await page.$eval('.toponym-card-title-view__coords-badge', el => el.textContent);

        // Virgulga qarab ajratish
        const [latitude, longitude] = cordinats.split(',').map(coord => coord.trim());

        // Share matnini olish
        const shareTextSelector = '.card-title-view__title';
        await page.waitForSelector(shareTextSelector, { timeout: 30000 });
        const addressName = await page.$eval(shareTextSelector, (el) => el.textContent.trim());

        console.log('Latitude:', latitude);
        console.log('Longitude:', longitude);
        console.log('Manzil nomi:', addressName);

        return { latitude, longitude, addressName }; // Koordinatalar va manzil nomini qaytarish
    } catch (error) {
        console.error('Xatolik yuz berdi:', error.message);
        return null;
    } finally {
        await browser.close();
    }
}

// Telegram bot hodisalari
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Salom! Manzilni yozing, men uni Yandex xaritadan topib beraman.');
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userInput = msg.text;

    // Agar foydalanuvchi /startdan boshqa biror matn yuborsa
    if (userInput && userInput !== '/start') {
        bot.sendMessage(chatId, 'Qidiruv natijalarini yuklayapman, iltimos kuting...');

        // Yandex orqali qidiruv
        const result = await searchAddressOnYandex(userInput);

        if (result) {
            const { latitude, longitude, addressName } = result;

            // Foydalanuvchiga joylashuvni yuborish
            await bot.sendLocation(chatId, parseFloat(latitude), parseFloat(longitude));
            await bot.sendMessage(chatId, `Manzil: ${addressName}`);
        } else {
            bot.sendMessage(chatId, 'Manzilni topib bo\'lmadi. Iltimos, boshqa manzil kiriting.');
        }
    }
});
