// server.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Use CORS to allow requests from your front-end
app.use(cors());

// The main API endpoint
app.get('/api/analyze', async (req, res) => {
    const youtubeUrl = req.query.url;

    if (!youtubeUrl || !youtubeUrl.includes('youtube.com')) {
        return res.status(400).json({ error: 'Please provide a valid YouTube URL.' });
    }

    try {
        const { data } = await axios.get(youtubeUrl, {
            headers: { // Use a browser user-agent to avoid being blocked
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(data);

        // --- Data Extraction Logic ---
        const channelName = $('meta[property="og:title"]').attr('content') || 'N/A';
        const isMonetized = data.includes('"is_monetization_enabled":true');
        const tags = $('meta[name="keywords"]').attr('content')?.split(', ').filter(tag => tag) || [];
        const thumbnail = $('meta[property="og:image"]').attr('content') || '';
        const channelUrl = $('meta[property="og:url"]').attr('content') || '';
        const channelId = channelUrl.includes('/channel/') ? channelUrl.split('/channel/')[1] : 'Could not find Channel ID';
        
        const result = {
            monetization: {
                status: isMonetized ? 'Likely Enabled' : 'Likely Disabled',
                checked: true,
            },
            tags: tags,
            channelId: channelId,
            thumbnail: thumbnail,
            earnings: { low: 'N/A', high: 'N/A' }, // Accurate earnings are not possible via scraping
            shadowban: { status: 'Cannot be determined', checked: false }, // Accurate shadowban detection is not possible via scraping
            channelInfo: {
                name: channelName,
                subscribers: 'N/A', 
                totalViews: 'N/A',
                videoCount: 'N/A'
            }
        };

        res.json(result);

    } catch (error) {
        console.error("Error during analysis:", error.message);
        res.status(500).json({ error: 'Failed to fetch or analyze the URL. It might be private, invalid, or a video link.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});