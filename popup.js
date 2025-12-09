// popup.js (V25 - 逻辑稳定)

const DEFAULT_SETTINGS = {
    sourceLang: 'auto', targetLang: 'zh', fontSize: 100, lineCount: 2,
    debounceDelay: 500, fontColor: '#FFFF00', bgColor: '#000000', isSubtitleEnabled: true
};

function adjustWindowSize() {
    // 尝试调整 pop-up 窗口大小，以适应内容
    const bodyHeight = document.body.scrollHeight;
    const bodyWidth = document.body.scrollWidth;
    
    const finalWidth = Math.min(Math.max(bodyWidth, 300), 350);
    const finalHeight = Math.min(bodyHeight, 600);
    
    // 异步更新，确保 DOM 渲染稳定
    setTimeout(() => {
        const measuredHeight = document.body.scrollHeight;
        document.body.style.height = `${Math.min(measuredHeight, 600)}px`;
        document.body.style.width = `${finalWidth}px`;
    }, 50); 
}

function updatePopupUI(settings) {
    document.getElementById('source-lang').value = settings.sourceLang;
    document.getElementById('target-lang').value = settings.targetLang;
    document.getElementById('font-size').value = settings.fontSize;
    document.getElementById('line-count').value = settings.lineCount;
    document.getElementById('debounce-delay').value = settings.debounceDelay;
    document.getElementById('font-color').value = settings.fontColor;
    document.getElementById('bg-color').value = settings.bgColor;

    document.getElementById('font-size-value').textContent = settings.fontSize;
    document.getElementById('line-count-value').textContent = settings.lineCount;
    document.getElementById('debounce-delay-value').textContent = settings.debounceDelay;
    
    const toggleButton = document.getElementById('toggle-subtitles');
    const isEnabled = (settings.isSubtitleEnabled === undefined) ? true : settings.isSubtitleEnabled;
    
    toggleButton.textContent = isEnabled ? '关闭字幕' : '打开字幕';
    toggleButton.className = isEnabled ? 'btn-danger' : 'btn-success'; 
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('toggle-subtitles');
    const resetButton = document.getElementById('reset-settings');

    // 1. 加载和初始化
    chrome.storage.sync.get(null, (data) => {
        const finalSettings = {
            sourceLang: data.sourceLang || DEFAULT_SETTINGS.sourceLang,
            targetLang: data.targetLang || DEFAULT_SETTINGS.targetLang,
            fontSize: data.fontSize || DEFAULT_SETTINGS.fontSize,
            lineCount: data.lineCount || DEFAULT_SETTINGS.lineCount,
            debounceDelay: data.debounceDelay || DEFAULT_SETTINGS.debounceDelay,
            fontColor: data.fontColor || DEFAULT_SETTINGS.fontColor,
            bgColor: data.bgColor || DEFAULT_SETTINGS.bgColor,
            isSubtitleEnabled: (data.isSubtitleEnabled === undefined) ? DEFAULT_SETTINGS.isSubtitleEnabled : data.isSubtitleEnabled
        };
        
        updatePopupUI(finalSettings);
        adjustWindowSize();
    });

    // 2. UI 事件绑定 (Range Inputs)
    ['font-size', 'line-count', 'debounce-delay'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            document.getElementById(`${id}-value`).textContent = e.target.value;
            adjustWindowSize(); 
        });
    });

    // 3. 应用设置
    document.getElementById('apply-settings').addEventListener('click', () => {
        const settings = {
            sourceLang: document.getElementById('source-lang').value, 
            targetLang: document.getElementById('target-lang').value,
            fontSize: parseInt(document.getElementById('font-size').value),
            lineCount: parseInt(document.getElementById('line-count').value),
            debounceDelay: parseInt(document.getElementById('debounce-delay').value),
            fontColor: document.getElementById('font-color').value, 
            bgColor: document.getElementById('bg-color').value      
        };

        chrome.storage.sync.set(settings, () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "APPLY_TRANSLATION_SETTINGS", ...settings });
            });
            const btn = document.getElementById('apply-settings');
            const originalText = btn.textContent;
            btn.textContent = '已应用！';
            setTimeout(() => { btn.textContent = originalText; }, 1000);
        });
    });
    
    // 4. 开关字幕
    toggleButton.addEventListener('click', () => {
        chrome.storage.sync.get('isSubtitleEnabled', (data) => {
            const currentState = (data.isSubtitleEnabled === undefined) ? true : data.isSubtitleEnabled;
            const newState = !currentState;
            
            chrome.storage.sync.set({ isSubtitleEnabled: newState }, () => {
                toggleButton.textContent = newState ? '关闭字幕' : '打开字幕';
                toggleButton.className = newState ? 'btn-danger' : 'btn-success'; 
                
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "APPLY_TRANSLATION_SETTINGS", isSubtitleEnabled: newState });
                });
            });
        });
    });

    // 5. 恢复默认
    resetButton.addEventListener('click', () => {
        chrome.storage.sync.get('isSubtitleEnabled', (data) => {
            const currentEnabled = (data.isSubtitleEnabled === undefined) ? DEFAULT_SETTINGS.isSubtitleEnabled : data.isSubtitleEnabled;
            
            // 重置时保留当前开关状态
            const resetData = { ...DEFAULT_SETTINGS, isSubtitleEnabled: currentEnabled, subtitleTop: null, subtitleLeft: null };

            chrome.storage.sync.set(resetData, () => {
                updatePopupUI(resetData);
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "APPLY_TRANSLATION_SETTINGS", ...resetData });
                });
                
                resetButton.textContent = '已恢复！';
                setTimeout(() => { resetButton.textContent = '恢复默认设置'; }, 1000);
            });
        });
    });

    // 6. 手动刷新
    document.getElementById('manual-refresh').addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "MANUAL_REFRESH" });
        });
        const btn = document.getElementById('manual-refresh');
        const originalText = btn.textContent;
        btn.textContent = '正在刷新...';
        setTimeout(() => { btn.textContent = originalText; }, 1500);
    });

    // 7. 导出
    document.getElementById('export-subtitles').addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if(tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "REQUEST_EXPORT_SUBTITLES" }, (response) => {
                    if (response && response.subtitles) {
                        const blob = new Blob([response.subtitles], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'youtube_translated_subtitles.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        document.getElementById('export-subtitles').textContent = '导出成功！';
                        setTimeout(() => { document.getElementById('export-subtitles').textContent = '导出字幕'; }, 1500);
                    } else {
                        alert('没有可导出的字幕，请确保视频已播放且字幕已开启。');
                    }
                });
            }
        });
    });
});