const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// The upgraded API endpoint using Puppeteer
app.get('/api/analyze', async (req, res) => {
    const youtubeUrl = req.query.url;

    if (!youtubeUrl || !youtubeUrl.includes('youtube.com/')) {
        return res.status(400).json({ error: 'Please provide a valid YouTube Channel URL.' });
    }
    
    let browser = null;

    try {
        // Launch Puppeteer with settings compatible with Render's free tier
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.goto(youtubeUrl, { waitUntil: 'networkidle2' }); // Wait until the page is fully loaded

        // Scrape the data after the page has loaded
        const result = await page.evaluate(() => {
            // Helper function to extract text
            const getText = (selector) => document.querySelector(selector)?.innerText.trim() || 'N/A';

            const channelName = getText('ytd-channel-name #text');
            
            // This is a complex selector to get stats robustly
            const subscriberCount = getText('#subscriber-count');
            const videoCount = getText('#videos-count');

            // Find all metadata spans and then find the one with "views"
            const metaSpans = Array.from(document.querySelectorAll('#description-container #metadata-container span.inline-metadata-item'));
            const viewsSpan = metaSpans.find(span => span.innerText.includes('views'));
            const totalViews = viewsSpan ? viewsSpan.innerText : 'N/A';

            const isMonetized = document.documentElement.innerHTML.includes('"is_monetization_enabled":true');
            const tags = document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(', ').filter(tag => tag) || [];
            const thumbnail = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
            const channelId = document.querySelector('meta[property="og:url"]')?.getAttribute('content')?.split('/channel/')[1] || 'N/A';
            
            return {
                monetization: { status: isMonetized ? 'Likely Enabled' : 'Likely Disabled', checked: true },
                tags,
                channelId,
                thumbnail,
                earnings: { low: 'N/A', high: 'N/A' },
                shadowban: { status: 'Cannot be determined', checked: false },
                channelInfo: {
                    name: channelName,
                    subscribers: subscriberCount,
                    totalViews: totalViews,
                    videoCount: videoCount
                }
            };
        });

        res.json(result);

    } catch (error) {
        console.error("Error during Puppeteer analysis:", error.message);
        res.status(500).json({ error: 'Failed to analyze the URL. It might be private or invalid.' });
    } finally {
        if (browser !== null) {
            await browser.close(); // Always close the browser
        }
    }
});

app.listen(PORT, () => {
    console.log(`Upgraded server with Puppeteer is running on port ${PORT}`);
});