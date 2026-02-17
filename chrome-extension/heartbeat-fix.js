// REPLACE THE sendHeartbeat FUNCTION IN background.js WITH THIS:

async function sendHeartbeat() {
    const result = await chrome.storage.local.get([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.IS_MONITORING,
        STORAGE_KEYS.USER
    ]);

    if (!result[STORAGE_KEYS.TOKEN] || !result[STORAGE_KEYS.IS_MONITORING]) {
        return;
    }

    try {
        await fetch(`${API_BASE_URL}/browser-activity/heartbeat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                'Accept': 'application/json'
            }
        });

        // Check for force-close commands
        if (result[STORAGE_KEYS.USER] && result[STORAGE_KEYS.USER].id) {
            const activityResponse = await fetch(`${API_BASE_URL}/browser-activity/student/${result[STORAGE_KEYS.USER].id}?per_page=10`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${result[STORAGE_KEYS.TOKEN]}`,
                    'Accept': 'application/json'
                }
            });

            if (activityResponse.ok) {
                const activityData = await activityResponse.json();
                console.log('📊 [HEARTBEAT] Activity data received:', activityData);

                if (activityData && activityData.data && activityData.data.length > 0) {
                    // Check for browser close command
                    const browserCloseCmd = activityData.data.find(a => a.url === 'FORCE_CLOSE_COMMAND');
                    if (browserCloseCmd) {
                        console.log('🔴 [BROWSER CLOSE] Command detected!');

                        if (typeof chrome !== 'undefined' && chrome.notifications) {
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icons/icon48.png',
                                title: 'Browser Closing',
                                message: 'Your teacher has requested to close your browser.',
                                priority: 2
                            });
                        }

                        await new Promise(resolve => setTimeout(resolve, 2000));

                        const windows = await chrome.windows.getAll();
                        for (const window of windows) {
                            await chrome.windows.remove(window.id);
                        }
                        return;
                    }

                    // Check for tab close commands
                    const tabCloseCommands = activityData.data.filter(a => a.url === 'FORCE_CLOSE_TAB_COMMAND');
                    console.log(`🔍 [TAB CLOSE] Found ${tabCloseCommands.length} commands`);

                    if (tabCloseCommands.length > 0) {
                        // Get all current tabs
                        const allTabs = await chrome.tabs.query({});
                        console.log(`📑 [TABS] Currently open (${allTabs.length}):`, allTabs.map(t => ({ id: t.id, url: t.url })));

                        for (const cmd of tabCloseCommands) {
                            const targetUrl = cmd.page_title;
                            console.log(`🎯 [TARGET] URL to close: "${targetUrl}"`);
                            console.log(`   [CMD DATA]`, cmd);

                            if (targetUrl) {
                                // Find matching tabs
                                const matchingTabs = allTabs.filter(tab => tab.url === targetUrl);
                                console.log(`   [MATCH] Found ${matchingTabs.length} matching tabs`);

                                if (matchingTabs.length > 0) {
                                    for (const tab of matchingTabs) {
                                        try {
                                            console.log(`   🔴 [CLOSING] Tab ID ${tab.id}: ${tab.url}`);
                                            await chrome.tabs.remove(tab.id);
                                            console.log(`   ✅ [SUCCESS] Tab ${tab.id} closed!`);
                                        } catch (error) {
                                            console.error(`   ❌ [ERROR] Failed to close tab ${tab.id}:`, error);
                                        }
                                    }
                                } else {
                                    console.log(`   ⚠️ [NO MATCH] No tabs with exact URL: "${targetUrl}"`);
                                    console.log(`   [AVAILABLE]`, allTabs.map(t => t.url));
                                }
                            } else {
                                console.log(`   ⚠️ [ERROR] Command has no target URL (page_title is empty)`);
                            }
                        }
                    }
                }
            } else {
                console.log('❌ [API ERROR] Failed to fetch activity:', activityResponse.status);
            }
        }
    } catch (error) {
        console.error('[HEARTBEAT ERROR]', error);
    }
}
