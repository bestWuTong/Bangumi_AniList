const App = {
    config: null,
    data: null,
    currentFilter: 'all',
    searchQuery: '',

    STATUS_MAP: { 1: '想看', 2: '看过', 3: '在看', 4: '搁置', 5: '抛弃' },

    async init() {
        await Promise.all([this.loadConfig(), this.loadData()]);
        this.setupBackground();
        this.setupHeader();
        this.setupNav();
        this.render();
        this.bindEvents();
    },

    async loadConfig() {
        try {
            const resp = await fetch('config.json');
            if (resp.ok) this.config = await resp.json();
        } catch (e) {
            console.warn('配置加载失败');
        }
    },

    async loadData() {
        try {
            const resp = await fetch('bangumi.json');
            if (!resp.ok) throw new Error('数据加载失败');
            this.data = await resp.json();
        } catch (e) {
            console.error('数据加载失败:', e);
            document.getElementById('anime-grid').innerHTML =
                '<div class="no-results">数据加载失败，请稍后重试</div>';
        }
    },

    // 背景设置
    setupBackground() {
        if (!this.config) return;
        const overlay = document.querySelector('.bg-overlay');
        const isMobile = window.innerWidth <= 768;
        const bgUrl = isMobile ? this.config.background_mobile : this.config.background;
        if (bgUrl) {
            overlay.style.backgroundImage = `url(${bgUrl})`;
        }

        // Favicon
        if (this.config.favicon) {
            document.getElementById('favicon').href = this.config.favicon;
        }
    },

    // 头部设置
    setupHeader() {
        if (!this.config || !this.data) return;
        const nickname = this.config.nickname || this.data.username || '';
        document.getElementById('nickname').textContent = nickname;
        document.title = `${nickname}的追番列表`;

        // 更新时间
        if (this.data.last_updated) {
            const d = new Date(this.data.last_updated);
            document.getElementById('update-time').textContent = d.toLocaleString('zh-CN');
        }

        // 头像
        const avatarEl = document.getElementById('avatar');
        const avatarLink = document.getElementById('avatar-link');
        if (this.config.avatar) {
            avatarEl.src = this.config.avatar;
            avatarLink.style.display = 'block';
        } else {
            avatarLink.style.display = 'none';
        }
        if (this.config.website) {
            avatarLink.href = this.config.website;
            avatarLink.style.cursor = 'pointer';
        } else {
            avatarLink.style.pointerEvents = 'none';
            avatarLink.style.cursor = 'default';
        }

        // Bangumi 按钮
        const baseUrl = this.config.bangumi_mirror || 'https://bgm.tv/';
        const bangumiBtn = document.getElementById('bangumi-btn');
        bangumiBtn.href = `${baseUrl}user/${this.data.username}`;
    },

    // 导航栏计数
    setupNav() {
        if (!this.data) return;
        const collections = this.data.collections || [];
        const counts = { all: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        collections.forEach(c => {
            if (c.type === 5) return; // 跳过抛弃
            counts.all++;
            if (counts[c.type] !== undefined) counts[c.type]++;
        });
        document.getElementById('count-all').textContent = counts.all;
        document.getElementById('count-doing').textContent = counts[3];
        document.getElementById('count-done').textContent = counts[2];
        document.getElementById('count-wish').textContent = counts[1];
        document.getElementById('count-onhold').textContent = counts[4];
    },

    // 事件绑定
    bindEvents() {
        // 筛选标签（只处理有 data-status 的按钮）
        document.querySelectorAll('.nav-tab[data-status]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.nav-tab[data-status]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.status;
                this.render();
            });
        });

        // 搜索
        const searchInput = document.getElementById('search');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.render();
        });

        // 移动端搜索切换
        document.getElementById('search-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            searchInput.classList.toggle('active');
            if (searchInput.classList.contains('active')) {
                searchInput.focus();
            }
        });

        // 弹窗关闭
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        // 词云
        document.getElementById('wordcloud-btn').addEventListener('click', () => this.openWordCloud());
        document.getElementById('wc-close').addEventListener('click', () => this.closeWordCloud());
        document.getElementById('wc-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeWordCloud();
        });

        // 返回顶部
        const backBtn = document.getElementById('back-to-top');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backBtn.classList.add('visible');
            } else {
                backBtn.classList.remove('visible');
            }
        });
        backBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // ESC 关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.getElementById('wc-overlay').classList.contains('active')) {
                    this.closeWordCloud();
                } else {
                    this.closeModal();
                }
            }
        });

        // 窗口大小变化更新背景
        window.addEventListener('resize', () => this.setupBackground());
    },

    // 筛选数据
    getFilteredData() {
        if (!this.data) return [];
        let list = this.data.collections || [];

        // 过滤抛弃
        list = list.filter(c => c.type !== 5);

        // 按状态筛选
        if (this.currentFilter !== 'all') {
            const filterType = parseInt(this.currentFilter);
            list = list.filter(c => c.type === filterType);
        }

        // 搜索
        if (this.searchQuery) {
            list = list.filter(c => {
                const s = c.subject || {};
                const name = (s.name || '').toLowerCase();
                const nameCn = (s.name_cn || '').toLowerCase();
                return name.includes(this.searchQuery) || nameCn.includes(this.searchQuery);
            });
        }

        return list;
    },

    // 图片 URL 处理
    getImageUrl(url) {
        if (!url) return '';
        if (this.config && this.config.bangumi_image_mirror) {
            return url.replace('https://lain.bgm.tv/', this.config.bangumi_image_mirror);
        }
        return url;
    },

    // 获取 Bangumi 链接
    getBangumiUrl(type, id) {
        const baseUrl = (this.config && this.config.bangumi_mirror) || 'https://bgm.tv/';
        return `${baseUrl}${type}/${id}`;
    },

    // 渲染番剧列表
    render() {
        const list = this.getFilteredData();
        const grid = document.getElementById('anime-grid');

        if (list.length === 0) {
            grid.innerHTML = '<div class="no-results">没有找到匹配的番剧</div>';
            return;
        }

        grid.innerHTML = list.map((c, i) => this.renderCard(c, i)).join('');
    },

    renderCard(collection, index) {
        const subject = collection.subject || {};
        const nameCn = subject.name_cn || subject.name || '未知';
        const coverUrl = this.getImageUrl(subject.images?.common);
        const showCover = this.config?.show_cover !== false;

        const coverHtml = showCover
            ? (coverUrl
                ? `<div class="anime-cover-wrapper"><img class="anime-cover" src="${coverUrl}" alt="${this.esc(nameCn)}" loading="lazy"></div>`
                : `<div class="anime-cover-wrapper"><div class="anime-cover-placeholder">♪</div></div>`)
            : '';

        return `
            <div class="anime-card" data-index="${index}">
                ${coverHtml}
                <div class="anime-card-info">
                    <div class="anime-card-title">${this.esc(nameCn)}</div>
                    <div class="anime-card-meta">
                        ${subject.score > 0 ? `
                            <div class="anime-card-score">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                ${subject.score}
                            </div>
                        ` : ''}
                        <span class="anime-card-status status-${collection.type}">${this.STATUS_MAP[collection.type]}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // 打开弹窗
    openModal(index) {
        const list = this.getFilteredData();
        const collection = list[index];
        if (!collection) return;

        const subject = collection.subject || {};
        const nameCn = subject.name_cn || subject.name || '未知';
        const showCover = this.config?.show_cover !== false;
        const coverUrl = this.getImageUrl(subject.images?.common);

        // 封面
        const coverWrap = document.querySelector('.modal-cover-wrap');
        const coverEl = document.getElementById('modal-cover');
        if (showCover && coverUrl) {
            coverWrap.style.display = '';
            coverEl.src = coverUrl;
        } else {
            coverWrap.style.display = 'none';
        }

        // 名称
        document.getElementById('modal-name-cn').textContent = nameCn;
        document.getElementById('modal-name').textContent = subject.name || '';

        // Bangumi 按钮
        document.getElementById('modal-bangumi-btn').href = this.getBangumiUrl('subject', subject.id);

        // 信息
        document.getElementById('modal-status').textContent = this.STATUS_MAP[collection.type];
        document.getElementById('modal-score').textContent = subject.score > 0 ? `${subject.score} 分` : '暂无评分';
        document.getElementById('modal-eps').textContent = subject.eps > 0 ? `${subject.eps} 集` : '未知';
        document.getElementById('modal-date').textContent = subject.date || '未知';

        // 标签
        const tagsEl = document.getElementById('modal-tags');
        const tags = subject.tags || [];
        if (tags.length > 0) {
            tagsEl.innerHTML = tags.map(t => `<span class="modal-tag">${this.esc(t.name || t)}</span>`).join('');
        } else {
            tagsEl.innerHTML = '<span style="color: var(--text-muted)">暂无标签</span>';
        }

        // 简介
        const summary = subject.short_summary || subject.summary || '暂无简介';
        document.getElementById('modal-summary').textContent = summary;

        // 显示弹窗
        document.getElementById('modal-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
        document.body.style.overflow = '';
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ========== 词云 ==========
    wcData: null,

    EXCLUDED_TAGS: ['TV', 'OVA', 'Movie', 'WEB', '剧场版', '总集篇', '日本'],
    WC_COLORS: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#FF8A65', '#81D4FA',
        '#A5D6A7', '#FFD54F', '#CE93D8', '#80DEEA',
        '#EF5350', '#42A5F5', '#66BB6A', '#FFA726'
    ],

    _isExcludedTag(name) {
        if (!name) return true;
        if (this.EXCLUDED_TAGS.includes(name)) return true;
        if (/^\d{4}$/.test(name)) return true;
        if (/\d+年|\d+月/.test(name)) return true;
        return false;
    },

    _getTagStats() {
        const data = this.data || this.wcData;
        if (!data) return [];
        const map = {};
        (data.collections || []).forEach(c => {
            (c.subject?.tags || []).forEach(t => {
                const name = t.name;
                if (name && !this._isExcludedTag(name)) {
                    map[name] = (map[name] || 0) + 1;
                }
            });
        });
        return Object.entries(map)
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count);
    },

    async openWordCloud() {
        if (!this.data && !this.wcData) {
            try {
                const resp = await fetch('bangumi.json');
                if (resp.ok) this.wcData = await resp.json();
            } catch (e) {
                console.error('词云数据加载失败:', e);
            }
        }
        const stats = this._getTagStats();
        if (stats.length === 0) return;

        const maxCount = stats[0].count;
        const minCount = stats[stats.length - 1].count;
        const logMax = Math.log(maxCount + 1);
        const logMin = Math.log(Math.max(minCount, 1) + 1);
        const logRange = logMax - logMin || 1;

        const container = document.getElementById('wc-container');
        container.innerHTML = '';

        const cw = container.offsetWidth;
        const ch = container.offsetHeight;
        const placed = [];
        const cx = cw / 2;
        const cy = ch / 2;

        const maxWords = stats.length;

        for (let i = 0; i < maxWords; i++) {
            const { text, count } = stats[i];
            const logVal = Math.log(count + 1);
            const norm = (logVal - logMin) / logRange;
            const fontSize = Math.round(6 + norm * 25);

            const word = document.createElement('span');
            word.className = 'wc-word';
            word.textContent = text;
            word.style.fontSize = fontSize + 'px';
            word.style.color = this.WC_COLORS[i % this.WC_COLORS.length];
            word.style.opacity = 0.6 + norm * 0.4;
            container.appendChild(word);

            const isVertical = Math.random() < 0.25;
            if (isVertical) {
                word.style.writingMode = 'vertical-rl';
                word.style.textOrientation = 'mixed';
            }

            const placedRect = this._placeWord(word, cx, cy, cw, ch, placed, isVertical);
            if (placedRect) {
                placed.push(placedRect);
                word.addEventListener('mouseenter', (e) => this._showWCTooltip(e, text, count));
                word.addEventListener('mousemove', (e) => this._moveWCTooltip(e));
                word.addEventListener('mouseleave', () => this._hideWCTooltip());
            } else {
                container.removeChild(word);
            }
        }

        document.getElementById('wc-overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    _placeWord(el, cx, cy, cw, ch, placed, isVertical) {
        const textW = el.offsetWidth;
        const textH = el.offsetHeight;
        const halfW = textW / 2;
        const halfH = textH / 2;

        let angle = Math.random() * Math.PI * 2;
        const step = 0.4;
        const maxSteps = 20000;

        for (let s = 0; s < maxSteps; s++) {
            const r = 1.5 + s * step;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            angle += step / Math.max(r, 1);

            if (x - halfW < 0 || x + halfW > cw ||
                y - halfH < 0 || y + halfH > ch) continue;

            let overlap = false;
            const pad = 4;
            for (const p of placed) {
                if (x - halfW - pad < p.x + p.halfW &&
                    x + halfW + pad > p.x - p.halfW &&
                    y - halfH - pad < p.y + p.halfH &&
                    y + halfH + pad > p.y - p.halfH) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                el.style.left = (x - halfW) + 'px';
                el.style.top = (y - halfH) + 'px';
                return { x, y, halfW, halfH };
            }
        }
        return null;
    },

    _showWCTooltip(e, text, count) {
        let tip = document.querySelector('.wc-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'wc-tooltip';
            document.body.appendChild(tip);
        }
        tip.textContent = `${text}: ${count} 次`;
        tip.classList.add('visible');
        this._moveWCTooltip(e);
    },

    _moveWCTooltip(e) {
        const tip = document.querySelector('.wc-tooltip');
        if (!tip) return;
        const x = e.clientX + 14;
        const y = e.clientY - 30;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
    },

    _hideWCTooltip() {
        const tip = document.querySelector('.wc-tooltip');
        if (tip) tip.classList.remove('visible');
    },

    closeWordCloud() {
        document.getElementById('wc-overlay').classList.remove('active');
        document.body.style.overflow = '';
        this._hideWCTooltip();
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // 弹窗点击事件（事件委托）
    document.getElementById('anime-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.anime-card');
        if (card) {
            App.openModal(parseInt(card.dataset.index));
        }
    });
});
