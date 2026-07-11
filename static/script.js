// 追番列表前端逻辑
const AnimeList = {
    data: null,
    config: null,
    currentFilter: 'all',
    searchQuery: '',

    // 初始化
    async init() {
        await this.loadConfig();
        await this.loadData();
        this.bindEvents();
    },

    // 加载配置
    async loadConfig() {
        try {
            const response = await fetch('config.json');
            if (response.ok) {
                this.config = await response.json();
            }
        } catch (error) {
            console.warn('加载配置失败，使用默认值');
        }
    },

    // 加载数据
    async loadData() {
        try {
            const response = await fetch('bangumi.json');
            if (!response.ok) {
                throw new Error('数据加载失败');
            }
            this.data = await response.json();
            this.updateHeader();
            this.render();
        } catch (error) {
            console.error('加载数据失败:', error);
            document.getElementById('anime-grid').innerHTML =
                '<div class="no-results">数据加载失败，请稍后重试</div>';
        }
    },

    // 更新头部信息
    updateHeader() {
        if (!this.data) return;

        const nickname = this.config?.nickname || this.data.user;
        document.getElementById('username').textContent = nickname;
        document.title = `追番列表 - ${nickname}`;

        // 格式化更新时间
        const updateTime = new Date(this.data.last_updated);
        const formatted = updateTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
        document.getElementById('update-time').textContent = formatted;
    },

    // 绑定事件
    bindEvents() {
        // 筛选按钮
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.status;
                this.render();
            });
        });

        // 搜索框
        document.getElementById('search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.render();
        });
    },

    // 筛选数据
    getFilteredData() {
        if (!this.data) return [];

        let list = this.data.anime_list || [];

        // 按状态筛选
        if (this.currentFilter !== 'all') {
            list = list.filter(a => a.status === this.currentFilter);
        }

        // 按搜索词筛选
        if (this.searchQuery) {
            list = list.filter(a =>
                a.name.toLowerCase().includes(this.searchQuery) ||
                (a.name_cn && a.name_cn.toLowerCase().includes(this.searchQuery))
            );
        }

        return list;
    },

    // 渲染统计信息
    renderStats() {
        if (!this.data) return;

        const list = this.data.anime_list || [];
        const stats = {
            total: list.length,
            watching: list.filter(a => a.status === '在看').length,
            watched: list.filter(a => a.status === '看过').length,
            wish: list.filter(a => a.status === '想看').length,
        };

        const statsHtml = `
            <div class="stat-card">
                <div class="number">${stats.total}</div>
                <div class="label">总计</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.watching}</div>
                <div class="label">在看</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.watched}</div>
                <div class="label">看过</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.wish}</div>
                <div class="label">想看</div>
            </div>
        `;

        document.getElementById('stats').innerHTML = statsHtml;
    },

    // 渲染番剧卡片
    renderCard(anime) {
        const config = this.config || {};

        // 名称显示
        const displayName = config.show_name_cn !== false ? (anime.name_cn || anime.name) : anime.name;
        const originalName = config.show_name_cn !== false && anime.name_cn ? anime.name : '';

        // 进度
        const epsW = anime.eps_watched || 0;
        const epsT = anime.eps_total || 0;
        const progress = epsT > 0 ? Math.round((epsW / epsT) * 100) : 0;

        // 封面图
        const coverHtml = config.show_cover && anime.cover
            ? `<img class="anime-cover" src="${anime.cover}" alt="${displayName}" loading="lazy">`
            : '';

        // 状态标签
        const statusHtml = config.show_status !== false
            ? `<span class="meta-tag status status-${anime.status}">${anime.status}</span>`
            : '';

        // 类型标签
        const typeHtml = config.show_type !== false
            ? `<span class="meta-tag">${anime.type}</span>`
            : '';

        // 集数标签
        const epsHtml = epsT > 0
            ? `<span class="meta-tag">${epsW}/${epsT} 集</span>`
            : '';

        // 评分
        const scoreHtml = config.show_score !== false && anime.score > 0
            ? `<span class="meta-tag score">${anime.score}</span>`
            : '';

        // 标签
        const tags = anime.tags || [];
        const tagsHtml = config.show_tags !== false && tags.length > 0
            ? `<div class="anime-tags">${tags.map(t => `<span class="anime-tag">${this.escapeHtml(t)}</span>`).join('')}</div>`
            : '';

        // 进度条
        const progressHtml = config.show_progress !== false
            ? `<div class="anime-progress">${epsT > 0 ? `进度: ${progress}%` : '集数未知'}</div>
               <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>`
            : '';

        // 开播时间
        const airDateHtml = config.show_air_date !== false && anime.air_date
            ? `<div class="anime-date">开播: ${anime.air_date}</div>`
            : '';

        // 简介
        const summary = anime.summary || '';
        const truncatedSummary = summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
        const summaryHtml = config.show_summary !== false && truncatedSummary
            ? `<div class="anime-summary">${this.escapeHtml(truncatedSummary)}</div>`
            : '';

        return `
            <div class="anime-card" data-id="${anime.id}">
                ${coverHtml}
                <div class="anime-info">
                    <div class="anime-title">${this.escapeHtml(displayName)}</div>
                    ${originalName ? `<div class="anime-title-en">${this.escapeHtml(originalName)}</div>` : ''}
                    <div class="anime-meta">
                        ${statusHtml}
                        ${typeHtml}
                        ${epsHtml}
                        ${scoreHtml}
                    </div>
                    ${tagsHtml}
                    ${progressHtml}
                    ${airDateHtml}
                    ${summaryHtml}
                </div>
            </div>
        `;
    },

    // 转义HTML
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // 主渲染函数
    render() {
        this.renderStats();

        const filteredList = this.getFilteredData();
        const grid = document.getElementById('anime-grid');

        if (filteredList.length === 0) {
            grid.innerHTML = '<div class="no-results">没有找到匹配的番剧</div>';
            return;
        }

        // 按状态排序: 在看 > 想看 > 看过 > 搁置
        const statusOrder = { '在看': 0, '想看': 1, '看过': 2, '搁置': 3, '抛弃': 4 };
        filteredList.sort((a, b) => {
            const orderA = statusOrder[a.status] ?? 5;
            const orderB = statusOrder[b.status] ?? 5;
            return orderA - orderB;
        });

        grid.innerHTML = filteredList.map(anime => this.renderCard(anime)).join('');
    },
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    AnimeList.init();
});
