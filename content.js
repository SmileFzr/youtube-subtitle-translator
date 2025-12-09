// content.js - V23 (增强了调试日志、样式优化和修复字幕不显示问题)

// === 1. 全局设置和变量 ===
let currentSettings = { 
    sourceLang: 'auto', targetLang: 'zh', fontSize: 100, lineCount: 2,
    debounceDelay: 500, fontColor: '#FFFF00', bgColor: '#000000',
    isSubtitleEnabled: true,
    subtitleTop: null, 
    subtitleLeft: null
};

let accumulatedSubtitles = ""; 
let translationTimer = null;   
let statusCheckInterval = null; 
let styleElement = null; 

// 拖拽变量
let translationDiv = null; 
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let divStartX = 0;
let divStartY = 0;
let dragListenersAdded = false; 

// 监控变量
let currentVideoId = null;
let mainObserver = null; 
let playerObserver = null; 

// === 辅助函数：Hex 转 RGBA ===
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // 使用 75% 透明度作为背景，防止全黑背景遮挡内容
    return `rgba(${r}, ${g}, ${b}, ${alpha})`; 
}

// 【新增辅助函数：等待】
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// === 辅助函数：样式注入 (Hover 效果) ===
function injectStyles() {
    if (document.getElementById('yt-translator-styles')) return;

    const css = `
        #my-translation-overlay {
            transition: opacity 0.3s ease;
        }
        /* 关闭按钮样式 */
        #my-translation-close-btn {
            position: absolute;
            top: -12px; 
            right: -12px;
            width: 24px; 
            height: 24px;
            padding: 0;
            border: 2px solid white;
            border-radius: 50%;
            background-color: #d9534f;
            color: white;
            font-size: 14px;
            font-weight: bold;
            line-height: 20px;
            cursor: pointer;
            z-index: 2147483648;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            opacity: 0; /* 默认隐藏 */
            transform: scale(0.8);
            transition: all 0.2s ease-in-out;
            pointer-events: auto; 
        }
        /* 鼠标悬停在面板上时，显示关闭按钮 */
        #my-translation-overlay:hover #my-translation-close-btn {
            opacity: 1;
            transform: scale(1);
        }
        #my-translation-close-btn:hover {
            background-color: #c9302c;
            transform: scale(1.1);
        }
    `;

    styleElement = document.createElement('style');
    styleElement.id = 'yt-translator-styles';
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
    console.log("🎨 [Style] 注入 CSS 样式 (V23)。");
}


// 🚀 【公共翻译接口 - 增加 429 重试逻辑】
async function translateText(text, sourceLang, targetLang) {
    if (!currentSettings.isSubtitleEnabled) { 
        return '';
    }
    if (!text || text.trim() === '') return '';
    
    const slParam = sourceLang === 'auto' ? 'auto' : sourceLang; 
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${slParam}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const MAX_RETRIES = 3; 
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url);
            
            if (response.status === 429 || response.status === 503) { 
                console.warn(`⚠️ [API Rate Limit] 翻译服务返回 ${response.status} (尝试 ${attempt}/${MAX_RETRIES})。`);
                if (attempt === MAX_RETRIES) {
                    throw new Error(`翻译服务因请求过多而失败 (${response.status})`);
                }
                const waitTime = Math.pow(2, attempt) * 1000; 
                await sleep(waitTime);
                continue; 
            }

            if (!response.ok) {
                throw new Error(`翻译服务请求失败，状态码: ${response.status}`);
            }
            
            const data = await response.json();
            let translatedText = '';
            if (data && data[0] && Array.isArray(data[0])) {
                translatedText = data[0].map(segment => segment[0]).join('');
            }
            
            if (!translatedText) {
                console.warn("⚠️ [API Result] 翻译接口返回空结果。");
            } else {
                console.log(`✅ [API Success] 翻译成功。`);
            }
            
            return translatedText || "翻译失败或结果为空。";

        } catch (error) {
            console.error(`❌ [API Error] 翻译接口第 ${attempt} 次调用错误:`, error.message);
            if (attempt === MAX_RETRIES) {
                return `网络或翻译接口错误：${error.message} (已达到最大重试次数)`;
            }
            
            const waitTime = Math.pow(2, attempt) * 1000;
            await sleep(waitTime);
        }
    }
    return "翻译服务调用失败。";
}


// === 2. 消息监听 ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === "APPLY_TRANSLATION_SETTINGS") {
            const oldStatus = currentSettings.isSubtitleEnabled;
            
            // 批量更新设置，使用 || 确保值存在
            currentSettings.sourceLang = request.sourceLang !== undefined ? request.sourceLang : currentSettings.sourceLang;
            currentSettings.targetLang = request.targetLang !== undefined ? request.targetLang : currentSettings.targetLang;
            currentSettings.fontSize = request.fontSize !== undefined ? request.fontSize : currentSettings.fontSize;
            currentSettings.lineCount = request.lineCount !== undefined ? request.lineCount : currentSettings.lineCount;
            currentSettings.debounceDelay = request.debounceDelay !== undefined ? request.debounceDelay : currentSettings.debounceDelay;
            currentSettings.fontColor = request.fontColor !== undefined ? request.fontColor : currentSettings.fontColor;
            currentSettings.bgColor = request.bgColor !== undefined ? request.bgColor : currentSettings.bgColor;
            
            currentSettings.subtitleTop = request.subtitleTop !== undefined ? request.subtitleTop : currentSettings.subtitleTop;
            currentSettings.subtitleLeft = request.subtitleLeft !== undefined ? request.subtitleLeft : currentSettings.subtitleLeft;
            
            if (request.isSubtitleEnabled !== undefined) {
                 currentSettings.isSubtitleEnabled = request.isSubtitleEnabled;
            }
            
            console.log("⚡️ [Settings] 新设置已接收并应用。"); 
            applyTranslationStyle(); 
            
            if (oldStatus !== currentSettings.isSubtitleEnabled) {
                 updateSubtitleVisibility(); 
            }

        } else if (request.action === "REQUEST_EXPORT_SUBTITLES") { 
            sendResponse({ subtitles: accumulatedSubtitles });
            return true; 
        } else if (request.action === "MANUAL_REFRESH") {
            console.log("🔄 [Monitor] 收到手动刷新请求，强制重启监控服务..."); 
            hardCleanup(false); 
            applyTranslationStyle(); 
            currentVideoId = null; 
            monitorSubtitles();
            return true; 
        }
    } catch (error) {
         if (!error.message.includes('Extension context invalidated')) {
             console.error("❌ [Message Error] 处理消息时发生错误:", error);
         }
    }
});

// === 状态轮询 ===
function startStatusCheckInterval() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }

    statusCheckInterval = setInterval(() => {
        try {
            chrome.storage.sync.get('isSubtitleEnabled', (data) => {
                const newStatus = (data.isSubtitleEnabled === undefined) ? true : data.isSubtitleEnabled;
                
                if (newStatus !== currentSettings.isSubtitleEnabled) {
                    currentSettings.isSubtitleEnabled = newStatus;
                    
                    if (!translationDiv && newStatus) { // 如果面板不存在但开启了，则创建
                        applyTranslationStyle();
                    }
                    updateSubtitleVisibility();
                }
            });
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                clearInterval(statusCheckInterval);
            }
        }
    }, 200); 
    console.log("⏱️ [Monitor] 状态轮询启动 (每 200ms)。");
}


// === 可见性控制 ===
function updateSubtitleVisibility() {
    if (!translationDiv) {
        translationDiv = document.getElementById('my-translation-overlay');
        if (!translationDiv) {
            if (currentSettings.isSubtitleEnabled) {
                applyTranslationStyle();
                translationDiv = document.getElementById('my-translation-overlay');
                if (!translationDiv) return; 
            } else {
                return; 
            }
        }
    }
    
    // 1. 控制翻译面板
    if (currentSettings.isSubtitleEnabled) {
        translationDiv.style.display = 'block';
        console.log("✅ [Status] 字幕翻译功能已打开。");
        
        // 如果监控链已断开 (例如刚从关闭状态开启)，在此处重启
        const originalCaptionWindow = document.querySelector('.ytp-caption-window-container');
        if (playerObserver === null || (originalCaptionWindow && !originalCaptionWindow.contentObserverInstance)) {
             console.log("💡 [Monitor] 字幕开启，正在重启字幕监听链..."); 
             accumulatedSubtitles = ""; 
             currentVideoId = null; 
             monitorSubtitles();
        }
        
    } else {
        // 如果禁用，强制移除面板和监听器
        hardCleanup(true); 
        console.log("❌ [Status] 字幕翻译功能已关闭。");
        return;
    }
    
    // 2. 控制原生字幕的隐藏/显示
    const originalCaptionWindow = document.querySelector('.ytp-caption-window-container');
    if (originalCaptionWindow) {
        originalCaptionWindow.style.opacity = currentSettings.isSubtitleEnabled ? '0' : '1';
        originalCaptionWindow.style.pointerEvents = 'none'; // 确保不被点击
    } 
}


// === UI 构建与样式应用 ===
function applyTranslationStyle() {
    // 1. 注入 CSS 样式 (处理 Hover)
    injectStyles();

    translationDiv = document.getElementById('my-translation-overlay'); 
    if (!translationDiv) {
        // ... (创建 translationDiv) ...
        translationDiv = document.createElement('div');
        translationDiv.id = 'my-translation-overlay';
        Object.assign(translationDiv.style, {
            position: 'fixed',
            zIndex: 2147483647,
            padding: '8px 12px', 
            borderRadius: '8px',
            textAlign: 'center',
            maxWidth: '85%',
            pointerEvents: 'none', 
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            cursor: 'default',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            transition: 'top 0.1s, left 0.1s' 
        });
        document.body.appendChild(translationDiv);
        setupDragListeners();
        console.log("🎨 [UI] 翻译面板 DOM 元素已创建。");
    }
    
    // 3. 创建关闭按钮 (如果不存在)
    let closeBtn = document.getElementById('my-translation-close-btn');
    if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.id = 'my-translation-close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            try { 
                chrome.storage.sync.set({ isSubtitleEnabled: false }); 
            } catch (err) {
                 currentSettings.isSubtitleEnabled = false;
                 updateSubtitleVisibility();
            }
        };
        translationDiv.appendChild(closeBtn);
    }
    
    // 4. 应用用户设置的动态样式 
    translationDiv.style.fontSize = `${currentSettings.fontSize}%`;
    translationDiv.style.color = currentSettings.fontColor; 
    // 【关键优化】使用 75% 透明度的背景色
    translationDiv.style.backgroundColor = hexToRgba(currentSettings.bgColor, 0.75); 
    
    // 5. 位置恢复/设置
    if (currentSettings.subtitleTop !== null && currentSettings.subtitleLeft !== null) {
        translationDiv.style.top = `${currentSettings.subtitleTop}px`;
        translationDiv.style.left = `${currentSettings.subtitleLeft}px`;
        translationDiv.style.bottom = 'auto';
        translationDiv.style.transform = 'none';
    } else {
        translationDiv.style.top = 'auto';
        translationDiv.style.bottom = '50px';
        translationDiv.style.left = '50%';
        translationDiv.style.transform = 'translateX(-50%)';
    }
    
    updateSubtitleVisibility(); 
    
    const originalCaptionWindow = document.querySelector('.ytp-caption-window-container');
    if (originalCaptionWindow) {
        originalCaptionWindow.style.pointerEvents = 'none'; 
    }
}


// === 拖拽逻辑 (保持稳定) ===
function handleDragStart(e) {
    if (e.target.id === 'my-translation-close-btn') return;

    if (e.altKey && translationDiv && translationDiv.contains(e.target)) { 
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = translationDiv.getBoundingClientRect();
        
        translationDiv.style.bottom = 'auto'; 
        translationDiv.style.transform = 'none'; 
        translationDiv.style.top = `${rect.top}px`;
        translationDiv.style.left = `${rect.left}px`;
        
        divStartX = rect.left;
        divStartY = rect.top;
        
        translationDiv.style.cursor = 'grabbing';
        e.preventDefault(); 
    }
}

function handleDragMove(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    translationDiv.style.left = `${divStartX + deltaX}px`;
    translationDiv.style.top = `${divStartY + deltaY}px`;
}

function handleDragEnd() {
    if (isDragging) {
        isDragging = false;
        if (translationDiv) {
            translationDiv.style.cursor = document.body.classList.contains('alt-key-pressed') ? 'grab' : 'default';
            const rect = translationDiv.getBoundingClientRect();
            try {
                chrome.storage.sync.set({ subtitleTop: rect.top, subtitleLeft: rect.left });
                currentSettings.subtitleTop = rect.top;
                currentSettings.subtitleLeft = rect.left;
            } catch (e) {}
        }
    }
}

function handleKeyDown(e) {
    if (e.key === 'Alt' && translationDiv) {
        translationDiv.style.pointerEvents = 'auto'; 
        translationDiv.style.cursor = 'grab';
        document.body.classList.add('alt-key-pressed');
    }
}

function handleKeyUp(e) {
    if (e.key === 'Alt' && translationDiv) {
        translationDiv.style.pointerEvents = 'none'; 
        translationDiv.style.cursor = 'default';
        isDragging = false; 
        document.body.classList.remove('alt-key-pressed');
    }
}

function setupDragListeners() {
    if (dragListenersAdded) return;
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    dragListenersAdded = true;
    console.log("✅ [Drag] 拖拽监听器已添加。");
}

function removeDragListeners() {
    if (!dragListenersAdded) return;
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    document.removeEventListener('mousedown', handleDragStart);
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    dragListenersAdded = false;
    console.log("🧹 [Drag] 拖拽监听器已移除。");
}


// === 清理与监控 ===
function hardCleanup(forceRemoveDom = false) {
    removeDragListeners(); 
    
    // 移除翻译面板
    translationDiv = document.getElementById('my-translation-overlay');
    if (translationDiv && translationDiv.parentNode && (forceRemoveDom || !currentSettings.isSubtitleEnabled)) {
        translationDiv.parentNode.removeChild(translationDiv);
        translationDiv = null;
        console.log("🗑️ [Cleanup] 翻译面板 DOM 已移除。"); 
    }

    // 移除注入的样式
    if (forceRemoveDom) {
        const style = document.getElementById('yt-translator-styles');
        if (style) style.parentNode.removeChild(style);
        styleElement = null;
    }

    // 确保原生字幕可见性恢复
    const originalCaptionWindow = document.querySelector('.ytp-caption-window-container');
    if (originalCaptionWindow) {
        originalCaptionWindow.style.opacity = '1';
        originalCaptionWindow.style.pointerEvents = 'auto';
    }
    
    // 清理所有观察者和定时器
    cleanupObservers();
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    
    document.body.classList.remove('alt-key-pressed');
    console.log("--- 🛑 [System] 已执行硬清理。---");
}


function cleanupObservers() {
    if (mainObserver) {
        mainObserver.disconnect();
        mainObserver = null;
    }
    if (playerObserver) {
        playerObserver.disconnect();
        playerObserver = null;
    }
    const oldCaptionWindow = document.querySelector('.ytp-caption-window-container');
    if (oldCaptionWindow && oldCaptionWindow.contentObserverInstance) {
        oldCaptionWindow.contentObserverInstance.disconnect();
        oldCaptionWindow.contentObserverInstance = null;
    }
    clearTimeout(translationTimer);
    accumulatedSubtitles = "";
    console.log("🧹 [Cleanup] 所有监控器和定时器已清理。");
}

function monitorSubtitles() {
    setTimeout(() => {
        const captionContainerSelector = '.ytp-caption-window-container'; 
        const playerContainerSelector = 'ytd-player';

        const initialCaptionWindow = document.querySelector(captionContainerSelector);
        if (initialCaptionWindow) {
            startCaptionContentObserver(initialCaptionWindow);
            console.log("🚀 [Monitor] 找到原生字幕容器，开始内容监听。");
            return;
        }
        
        mainObserver = new MutationObserver((mutationsList, observer) => {
            const playerContainer = document.querySelector(playerContainerSelector);

            if (playerContainer) {
                observer.disconnect(); 
                setupVideoChangeObserver(playerContainer);
                attemptContentObserverSetup(playerContainer);
                console.log("🎬 [Monitor] 找到播放器容器，开始视频和字幕窗口监控。");
            }
        });

        mainObserver.observe(document.body, { childList: true, subtree: true });
    }, 50); 
}

function setupVideoChangeObserver(playerContainer) {
    if (playerObserver) playerObserver.disconnect();
    playerObserver = new MutationObserver(() => {
        const newId = new URLSearchParams(window.location.search).get('v');
        if (newId && newId !== currentVideoId) {
            console.log(`🎥 [Video] 检测到新视频: ${newId}`); 
            currentVideoId = newId;
            if (translationDiv) translationDiv.innerHTML = "";
            cleanupObservers(); // 清理旧的字幕观察器
            attemptContentObserverSetup(playerContainer);
        }
    });
    playerObserver.observe(playerContainer, { childList: true, subtree: true, attributes: true });
    currentVideoId = new URLSearchParams(window.location.search).get('v');
}

function attemptContentObserverSetup(playerContainer) {
    const win = playerContainer.querySelector('.ytp-caption-window-container');
    if (win) startCaptionContentObserver(win);
}

function startCaptionContentObserver(originalCaptionWindow) {
    applyTranslationStyle();
    const translationDivLocal = document.getElementById('my-translation-overlay');

    let lastOriginalText = "";
    
    if (originalCaptionWindow.contentObserverInstance) {
        originalCaptionWindow.contentObserverInstance.disconnect();
        console.log("🚨 [Monitor] 旧的字幕内容观察器已被替换/断开。"); 
    }

    const contentObserver = new MutationObserver(async (mutations) => {
        if (!currentSettings.isSubtitleEnabled || !translationDivLocal) { 
            if(translationDivLocal) translationDivLocal.innerHTML = "";
            return;
        }
        
        const captionSegments = originalCaptionWindow.querySelectorAll('.ytp-caption-segment');
        
        if (captionSegments.length === 0) {
            translationDivLocal.innerHTML = "";
            lastOriginalText = "";
            clearTimeout(translationTimer); 
            return;
        }

        const currentOriginalText = Array.from(captionSegments)
                                       .map(segment => segment.textContent.trim())
                                       .join(' '); 

        if (currentOriginalText && currentOriginalText !== lastOriginalText) {
            lastOriginalText = currentOriginalText;
            
            clearTimeout(translationTimer);
            
            translationTimer = setTimeout(async () => {
                console.log(`💬 [Subtitle] 捕捉到新字幕，内容长度: ${currentOriginalText.length}，准备翻译...`); // 增加日志
                
                const translatedText = await translateText(
                    currentOriginalText, 
                    currentSettings.sourceLang, 
                    currentSettings.targetLang
                );
                
                if (translatedText && !translatedText.includes("错误")) {
                    const lines = translatedText.split('\n');
                    const limitedText = lines.slice(0, currentSettings.lineCount).join('<br>');
                    translationDivLocal.innerHTML = limitedText;
                    
                    accumulatedSubtitles += translatedText + "\n";
                    console.log(`✨ [Translation] 翻译完成并显示。`); 
                } else {
                    translationDivLocal.innerHTML = `⚠️ 翻译失败: ${translatedText}`;
                    console.error(`❌ [Translation Error] 翻译失败或返回错误信息: ${translatedText}`);
                }
                
            }, currentSettings.debounceDelay);
        }
    });

    contentObserver.observe(originalCaptionWindow, { 
        childList: true, 
        subtree: true, 
        characterData: true 
    });
    originalCaptionWindow.contentObserverInstance = contentObserver; 
    console.log("✅ [Monitor] 字幕内容观察器已成功附加到字幕窗口。"); 
}

// 初始化加载
try {
    chrome.storage.sync.get([
        'sourceLang', 'targetLang', 'fontSize', 'lineCount', 'fontColor', 'bgColor', 
        'debounceDelay', 'isSubtitleEnabled', 
        'subtitleTop', 'subtitleLeft' 
    ], (data) => {
        
        // ... (省略设置加载，保持与 popup.js 一致的初始化逻辑) ...
        currentSettings.sourceLang = data.sourceLang || 'auto'; 
        currentSettings.targetLang = data.targetLang || 'zh';
        currentSettings.fontSize = data.fontSize || 100;
        currentSettings.lineCount = data.lineCount || 2;
        currentSettings.debounceDelay = data.debounceDelay || 500; 
        currentSettings.fontColor = data.fontColor || '#FFFF00'; 
        currentSettings.bgColor = data.bgColor || '#000000';
        currentSettings.isSubtitleEnabled = (data.isSubtitleEnabled === undefined) ? true : data.isSubtitleEnabled; 
        
        currentSettings.subtitleTop = data.subtitleTop !== undefined ? data.subtitleTop : null;
        currentSettings.subtitleLeft = data.subtitleLeft !== undefined ? data.subtitleLeft : null;
        
        console.log("⚙️ [Init] 扩展程序已加载。当前状态: " + (currentSettings.isSubtitleEnabled ? "打开" : "关闭")); 
        
        monitorSubtitles(); 
        startStatusCheckInterval(); 
        
        const port = chrome.runtime.connect({name: "content-script-init"});
        port.onDisconnect.addListener(() => {
            console.warn("💀 [Unload Trigger] 扩展程序环境断开连接，执行清理。"); 
            hardCleanup(true);
        });

    });
} catch (error) {
    if (error.message.includes('Extension context invalidated')) {
        console.error("❌ [Init Error] Context invalidated during initialization. Monitoring aborted.");
    } else {
        console.error("❌ [Init Error] 初始化过程中发生未知错误:", error);
    }
}