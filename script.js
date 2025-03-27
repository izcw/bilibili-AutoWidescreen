// ==UserScript==
// @name        bilibili | b站播放页自动宽屏
// @author      izcw
// @license     MIT
// @namespace   nana_vao_script
// @description B站播放页自动宽屏、滚动控制、导航显示、带悬浮面板
// @version     1.0.0
// @match       /^https?://www\.bilibili\.com/video/(BV|av)\w+/
// @include     /^https?://(www\.bilibili\.com/(video/(BV|av)|bangumi/play|medialist|list)|bangumi\.bilibili\.com/anime)/
// @run-at      document-end
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_addStyle
// @grant       GM_getResourceURL
// @icon        https://www.bilibili.com/favicon.ico
// @downloadURL https://github.com/izcw/bilibili-AutoWidescreen/raw/main/script.js
// @updateURL   https://github.com/izcw/bilibili-AutoWidescreen/raw/main/script.meta.js
// ==/UserScript==

(function () {
    'use strict';

    /* 配置管理模块 */
    const ConfigManager = {
        defaultConfig: {
            pageSettings: [
                { name: "普通视频", title: 'video', status: true },
                { name: "番剧", title: 'bangumi', status: true },
                { name: "收藏夹", title: 'medialist', status: true },
                { name: "列表", title: 'list', status: true }
            ],
            autoScroll: { // 自动滚动
                enabled: false,
                offset: 100
            },
            showHeader: false, // 显示导航
            burnInProtection: {  // 新增防烧屏配置
                enabled: true,
                step: 1,        // 单次移动像素
                maxOffset: 100,  // 最大偏移量
                interval: 10000 // 移动间隔(ms)
            }
        },

        getConfig() {
            const savedConfig = GM_getValue('biliConfig', {});
            return this.migrateConfig(savedConfig);
        },

        saveConfig(config) {
            GM_setValue('biliConfig', config);
        },

        migrateConfig(config) {
            if (config.enabledPages && !config.pageSettings) {
                config.pageSettings = Object.entries(config.enabledPages).map(([title, status]) => ({
                    name: this.getPageName(title),
                    title,
                    status
                }));
                delete config.enabledPages;
            }
            return Object.assign({}, this.defaultConfig, config);
        },

        getPageName(title) {
            const nameMap = {
                video: '普通视频',
                bangumi: '番剧',
                medialist: '收藏夹',
                list: '列表'
            };
            return nameMap[title] || title;
        }
    };

    /* 悬浮控制面板模块 */
    const FloatPanel = {
        panel: null,
        isExpanded: false,

        init() {
            this.createPanel();
            this.bindEvents();
            this.applyPanelStyles();
        },

        createPanel() {
            const config = ConfigManager.getConfig();

            this.panel = document.createElement('div');
            this.panel.id = 'bili-auto-wide-panel';
            this.panel.innerHTML = `
                <div class="config-content">
                    <div class="header">
                        <h3>bilibili播放页增强设置</h3>
                        <button class="close-btn-tool">×</button>
                    </div>
                    <div class="config-section">
                        <h4>宽屏-页面类型（只有在勾选的视频类型才触发）</h4>
                        <div class="config-items">
                            ${config.pageSettings.map(item => `
                                <label>
                                    <input type="checkbox"
                                        data-type="page"
                                        data-title="${item.title}"
                                        ${item.status ? 'checked' : ''}>
                                    ${item.name}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="config-section">
                        <h4>界面显示</h4>
                        <div class="config-items">
                            <label>
                                <input type="checkbox"
                                    data-type="showHeader"
                                    ${config.showHeader ? 'checked' : ''}>
                                显示顶部导航条
                            </label>
                        </div>
                    </div>
                    <div class="config-section">
                        <h4>自动滚动</h4>
                        <div class="config-items">
                            <label>
                                <input type="checkbox"
                                    data-type="autoScroll"
                                    ${config.autoScroll.enabled ? 'checked' : ''}>
                                启用页面自动滚动
                            </label>
                            <label>
                                滚动距离(0-1000)：
                                <input type="number" class="number-input" value="${config.autoScroll.offset}" min="0" max="1000" step="10">
                                px
                            </label>
                        </div>
                    </div>
                    <div class="config-section">
                        <h4>工具按钮防烧屏设置</h4>
                        <div class="config-items">
                            <label>
                                <input type="checkbox"
                                    data-type="burnInProtection"
                                    ${config.burnInProtection.enabled ? 'checked' : ''}>
                                启用面板防烧屏保护
                            </label>
                            <label>
                                移动幅度(0-100)：
                                <input type="number" class="number-input"
                                    value="${config.burnInProtection.maxOffset}"
                                    min="10" max="100" step="5">
                                px
                            </label>
                        </div>
                    </div>
                    <div class="footer">
                        <button class="save-btn">保存配置</button>
                    </div>
                    <div class="other">
                        <a href="https://www.zhangchengwei.work/message" target="_blank" rel="帮助" title="帮助">帮助</a>
                        <a href="https://github.com/izcw/bilibili-AutoWidescreen" target="_blank" rel="Github" title="Github">Github</a>
                    </div>
                </div>
            `;
            setTimeout(() => {
                document.getElementById('mirror-vdcon').append(this.panel);
            }, 3000)
        },

        applyPanelStyles() {
            GM_addStyle(`
                #mirror-vdcon {
                    position: relative;
                }

                #bili-auto-wide-panel {
                    position: absolute;
                    top: 0;
                    right: 20px;
                    z-index: 9999;
                    width: 30px;
                    height: 14px;
                    border-radius: 0 0 6px 6px;
                    box-shadow: 0 0px 12px #00000030;
                    background: #00AEEC;
                    cursor: pointer;
                    transition: transform 1s ease-in-out; /* 平滑移动动画 */
                    overflow: hidden;
                }
                #bili-auto-wide-panel.expanded {
                    width: 320px;
                    height: auto;
                    max-height: 90vh;
                    border-radius: 8px;
                    background: #fff;
                }
                .config-content {
                    display: none;
                    padding: 15px;
                }
                #bili-auto-wide-panel.expanded .config-content {
                    display: block;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .header h3{
                    font-size: 14px;
                }
                .close-btn-tool {
                    width: 30px;
                    height: 30px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    border-radius: 6px;
                    box-sizing: border-box;
                }
                .close-btn-tool:hover{
                    background: #EFEFEF;
                }
                .config-section {
                    margin-bottom: 15px;
                }
                .config-section h4 {
                    margin: 0 0 10px 0;
                    color: #00A1D6;
                    border-bottom: 1px solid #eee;
                    padding: 4px 0;
                }
                .config-items {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    color: #444;
                }
                .config-items label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                }
                .number-input {
                    width: 80px;
                    padding: 4px;
                    border: 1px solid #00A1D6;
                }
                .footer {
                    margin-top: 15px;
                    text-align: right;
                }
                .save-btn {
                    padding: 6px 20px;
                    background: #00a1d6;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .other a{
                    color:#999;
                    padding-right: 4px;
                }
                a:hover{
                    color: #00A1D6;
                }
            `);
        },

        bindEvents() {
            this.panel.addEventListener('click', (e) => {
                if (!this.isExpanded && e.target === this.panel) {
                    this.expandPanel();
                }
            });

            this.panel.querySelector('.close-btn-tool').addEventListener('click', (e) => {
                e.stopPropagation();
                this.collapsePanel();
            });

            this.panel.querySelector('.save-btn').addEventListener('click', () => {
                this.saveConfig();
            });
        },

        expandPanel() {
            this.isExpanded = true;
            this.panel.classList.add('expanded');
        },

        collapsePanel() {
            this.isExpanded = false;
            this.panel.classList.remove('expanded');
        },

        saveConfig() {
            const config = ConfigManager.getConfig();
            const inputValue = this.panel.querySelector('.number-input').value;

            // 增强输入验证逻辑
            let offset = Number(inputValue);
            if (isNaN(offset) || offset < 0 || offset > 1000) {
                offset = 0;  // 超出范围或非法输入时强制归零
                this.panel.querySelector('.number-input').value = 0;  // 同步更新UI
            }

            config.autoScroll = {
                enabled: this.panel.querySelector('input[data-type="autoScroll"]').checked,
                offset: offset
            };

            config.showHeader = this.panel.querySelector('input[data-type="showHeader"]').checked;

            ConfigManager.saveConfig(config);
            this.collapsePanel();
            setTimeout(() => location.reload(), 300);
        }
    };

    /* 核心功能模块 */
    const Core = {
        init() {
            FloatPanel.init();
            const config = ConfigManager.getConfig();
            this.toggleHeader(config.showHeader);

            if (this.shouldEnable()) {
                // 仅在勾选类型中触发以下功能
                this.toggleHeader(config.showHeader);
                this.autoWidescreen(() => {
                    this.handleAutoScroll(config);
                });
            } else {
                // 非勾选类型时恢复默认
                this.toggleHeader(true);
                window.scrollTo(0, 0);
            }

            if (config.burnInProtection.enabled) {
                this.startBurnInProtection();
            }
        },

        shouldEnable() {
            const pageType = this.getPageType();
            const config = ConfigManager.getConfig();
            return config.pageSettings.some(item =>
                item.title === pageType && item.status
            );
        },

        getPageType() {
            const path = location.pathname;
            if (path.includes('/video/')) return 'video';
            if (path.includes('/bangumi/')) return 'bangumi';
            if (path.includes('/medialist/')) return 'medialist';
            if (path.includes('/list/')) return 'list';
        },

        autoWidescreen(callback) {
            new MutationObserver((_, observer) => {
                const btn = document.querySelector('.bpx-player-ctrl-wide, .bilibili-player-wide-btn');
                if (btn) {
                    btn.click();
                    observer.disconnect();
                    if (typeof callback === 'function') callback();
                }
            }).observe(document.body, { subtree: true, childList: true });
        },

        toggleHeader(show) {
            const header = document.querySelector('#biliMainHeader');
            if (header) {
                header.style.display = show ? 'block' : 'none';
            }
        },

        handleAutoScroll(config) {
            if (config.autoScroll.enabled) {
                window.scrollTo(0, config.autoScroll.offset);
            }
        },

        startBurnInProtection() {
            const config = ConfigManager.getConfig().burnInProtection;
            let currentOffset = 0;
            let direction = 1; // 1=左移，-1=右移

            setInterval(() => {
                if (currentOffset >= config.maxOffset) direction = -1;
                if (currentOffset <= 0) direction = 1;

                currentOffset += direction * config.step;
                FloatPanel.panel.style.transform = `translateX(-${currentOffset}px)`;
            }, config.interval);
        }
    };

    // 初始化
    Core.init();
})();