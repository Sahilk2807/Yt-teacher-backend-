const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.get('/api/analyze', async (req, res) => {
    const youtubeUrl = req.query.url;

    if (!youtubeUrl || !youtubeUrl.includes('youtube.com/')) {
        return res.status(400).json({ error: 'Please provide a valid YouTube Channel URL.' });
    }
    
    let browser = null;

    try {
        const executablePath = await chromium.executablePath;

        // Fallback check: If the executable path is not found, throw a clear error.
        if (!executablePath) {
          throw new Error('Chromium executable not found, buildpack may have failed.');
        }

        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.goto(youtubeUrl, { waitUntil: 'networkidle2', timeout: 60000 }); // Added a 60s timeout here too

        const result = await page.evaluate(() => {
            const getText = (selector) => document.querySelector(selector)?.innerText.trim() || 'N/A';

            const channelName = getText('ytd-channel-name #text') || getText('yt-formatted-string#text.ytd-channel-name');
            const subscriberCount = getText('#subscriber-count');
            const videoCount = getText('#videos-count');
            
            const metaSpans = Array.from(document.querySelectorAll('#description-container #metadata-container span.inline-metadata-item'));
            const viewsSpan = metaSpans.find(span => span.innerText.toLowerCase().includes('views'));
            const totalViews = viewsSpan ? viewsSpan.innerText : 'N/A';

            const pageContent = document.documentElement.innerHTML;
            const isMonetized = pageContent.includes('"is_monetization_enabled":true');
            const tags = document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(',').map(s => s.trim()).filter(tag => tag) || [];
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
        // Provide a more specific error message back to the front-end
        res.status(500).json({ error: `Analysis failed: ${error.message}` });
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Final server version is running on port ${PORT}`);
});