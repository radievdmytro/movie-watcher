import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const downloadPath = __dirname;
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
    });
    console.log("Navigating...");
    await page.goto('https://dropmefiles.com/SLFtN', { waitUntil: 'networkidle2' });
    console.log("Clicking download...");
    await page.click('.start_dl_btn');
    console.log("Waiting for 15s to download...");
    await new Promise(r => setTimeout(r, 15000));
    await browser.close();
    console.log("Done");
})();
