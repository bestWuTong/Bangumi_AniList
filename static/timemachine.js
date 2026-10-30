/* ============================================================
   追番时光机
   ============================================================ */
(function () {
    'use strict';

    const CFG_URL = 'config.json';
    const DATA_URL = 'bangumi.json';

    const STATUS = { 1: '想看', 2: '看过', 3: '在看', 4: '搁置', 5: '抛弃' };

    const state = {
        cfg: {},
        items: [],
        eras: [],
        byId: new Map(),
        eraEls: [],
        activeIdx: -1,
        reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        lastFocus: null
    };

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

    /* ---------------- 工具 ---------------- */

    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);

    const pad2 = (n) => (n < 10 ? '0' + n : String(n));

    function seasonOf(month) {
        if (!month) return { key: 'winter', label: '—' };
        if (month <= 3) return { key: 'winter', label: '冬' };
        if (month <= 6) return { key: 'spring', label: '春' };
        if (month <= 9) return { key: 'summer', label: '夏' };
        return { key: 'autumn', label: '秋' };
    }

    async function fetchJSON(url) {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(url + ' 加载失败: ' + res.status);
        return res.json();
    }

    /* ---------------- 数据 ---------------- */

    function normalize(c) {
        const s = c.subject || {};
        const raw = String(s.date || '').trim();
        const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(raw);
        const year = m ? parseInt(m[1], 10) : null;
        const month = m && m[2] ? parseInt(m[2], 10) : 0;
        const day = m && m[3] ? parseInt(m[3], 10) : 0;

        const images = s.images || {};
        const cover = images.common || images.medium || images.large || images.small || '';

        let md = '时间未定';
        if (m) {
            md = month ? (day ? pad2(month) + '.' + pad2(day) : pad2(month) + '月') : '年内';
        }

        return {
            id: s.id,
            title: s.name_cn || s.name || '未知番剧',
            jp: s.name || '',
            date: raw,
            year: year,
            month: month,
            day: day,
            md: md,
            sortKey: m ? Date.UTC(year, (month || 1) - 1, day || 1) : Number.MAX_SAFE_INTEGER,
            score: Number(s.score) || 0,
            eps: Number(s.eps) || 0,
            rank: Number(s.rank) || 0,
            tags: (s.tags || []).map((t) => t.name).filter(Boolean).slice(0, 10),
            summary: s.short_summary || s.summary || '',
            cover: cover,
            status: c.type,
            ord: 0
        };
    }

    function compare(a, b) {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.title.localeCompare(b.title, 'zh-CN');
    }

    function buildEras(items) {
        const map = new Map();
        items.forEach((it) => {
            const key = it.year ? String(it.year) : 'unknown';
            if (!map.has(key)) map.set(key, { key: key, year: it.year, items: [] });
            map.get(key).items.push(it);
        });
        return Array.from(map.values()).sort((a, b) => {
            if (a.year == null) return 1;
            if (b.year == null) return -1;
            return a.year - b.year;
        });
    }

    function imageUrl(url) {
        if (!url) return '';
        const a = state.cfg.anilist || {};
        if (a.use_fetched_covers) {
            const name = url.split('/').pop();
            if (name) return 'static/covers/' + name;
        }
        return mirrorUrl(url);
    }

    function mirrorUrl(url) {
        if (!url) return '';
        const mirror = (state.cfg.anilist || {}).bangumi_image_mirror;
        return mirror ? url.replace('https://lain.bgm.tv/', mirror) : url;
    }

    function bangumiUrl(id) {
        const base = (state.cfg.anilist || {}).bangumi_mirror || 'https://bgm.tv/';
        return base + 'subject/' + id;
    }

    /* ---------------- 渲染 ---------------- */

    function applyConfig() {
        const a = state.cfg.anilist || {};
        const nickname = a.nickname || '';
        document.title = nickname ? nickname + '的追番时光机' : '追番时光机';
        if (a.favicon) {
            const fav = $('#favicon');
            if (fav) fav.href = a.favicon;
        }
    }

    function renderHero(items) {
        const dated = items.filter((it) => it.year);
        const minY = dated.length ? dated[0].year : null;
        const maxY = dated.length ? dated[dated.length - 1].year : null;
        const yearCount = state.eras.filter((e) => e.year).length;

        const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
        set('fig-total', items.length);
        set('fig-span', minY ? (maxY - minY + 1) : '—');
        set('fig-years', yearCount);
        set('fig-latest', maxY || '—');

        const sub = $('#era-panel-sub');
        if (sub && minY) sub.textContent = minY + ' — ' + maxY;

        const kicker = $('#hero-kicker');
        if (kicker && minY) {
            kicker.textContent = 'ANIME TIME MACHINE / ' + minY + ' — ' + maxY;
        }
        return { minY: minY, maxY: maxY };
    }

    function renderEraBars(items, range) {
        const host = $('#era-bars');
        if (!host) return;
        if (!range.minY) { host.innerHTML = ''; return; }

        const counts = new Map();
        items.forEach((it) => {
            if (!it.year) return;
            counts.set(it.year, (counts.get(it.year) || 0) + 1);
        });

        let max = 1;
        counts.forEach((n) => { if (n > max) max = n; });

        const total = Math.max(1, range.maxY - range.minY);
        const span = range.maxY - range.minY + 1;
        const step = span <= 48 ? 5 : (span <= 96 ? 10 : 20);
        const out = [];
        for (let y = range.minY; y <= range.maxY; y++) {
            const n = counts.get(y) || 0;
            const ratio = n / max;
            const t = (y - range.minY) / total;
            const r = Math.round(120 + 125 * t);
            const g = Math.round(196 - 78 * t);
            const b = Math.round(240 - 30 * t);
            const color = 'rgb(' + r + ',' + g + ',' + b + ')';
            const showLabel = (y % step === 0) || y === range.minY;
            out.push(
                '<button type="button" class="ebar" data-year="' + y + '"' +
                ' style="--h:' + ratio.toFixed(3) + ';--c:' + color + '"' +
                ' aria-label="' + y + ' 年，' + n + ' 部"' + (n ? '' : ' disabled') + '>' +
                '<span class="ebar-tip">' + y + ' · ' + n + ' 部</span>' +
                '<i></i><em>' + (showLabel ? y : '') + '</em>' +
                '</button>'
            );
        }
        host.innerHTML = out.join('');

        host.addEventListener('click', (e) => {
            const btn = e.target.closest('.ebar');
            if (!btn || btn.disabled) return;
            const target = document.getElementById('y-' + btn.dataset.year);
            if (target) scrollToEl(target, 88);
        });
    }

    function renderDecadeRail() {
        const rail = $('#decade-rail');
        if (!rail) return;
        const decades = [];
        state.eras.forEach((era) => {
            if (!era.year) return;
            const d = Math.floor(era.year / 10) * 10;
            if (decades.indexOf(d) === -1) decades.push(d);
        });
        if (decades.length < 2) { rail.style.display = 'none'; return; }

        rail.innerHTML = decades.map((d) =>
            '<button type="button" class="rail-item" data-decade="' + d + '" aria-label="跳到 ' + d + ' 年代">' +
            '<i></i><span>' + d + 's</span></button>'
        ).join('');

        rail.addEventListener('click', (e) => {
            const btn = e.target.closest('.rail-item');
            if (!btn) return;
            const target = state.eras.find((era) => era.year && Math.floor(era.year / 10) * 10 === Number(btn.dataset.decade));
            if (!target) return;
            const el = document.getElementById('y-' + target.key);
            if (el) scrollToEl(el, 88);
        });
    }

    function cardHTML(it) {
        const cover = imageUrl(it.cover);
        const mirror = mirrorUrl(it.cover);
        const season = seasonOf(it.month);
        const score = it.score > 0
            ? '<span class="card-score"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.9-5 4.8 1.2 6.9L12 17.7 6 20.9l1.2-6.9-5-4.8 6.9-.9z"/></svg>' + it.score.toFixed(1) + '</span>'
            : '';

        const poster = cover
            ? '<img src="' + esc(cover) + '" alt="' + esc(it.title) + ' 封面" loading="lazy" decoding="async"' +
              ' onerror="this.onerror=null;this.src=\'' + esc(mirror) + '\'">'
            : '<div class="card-noimg">NO IMAGE</div>';

        return '' +
            '<article class="card" role="button" tabindex="0" data-id="' + it.id + '"' +
            ' aria-label="' + esc(it.title) + '，' + (it.year ? it.year + ' 年 ' + it.md + ' 播出' : '播出时间未定') + '">' +
                '<div class="card-poster">' +
                    poster +
                    '<span class="card-ord">#' + String(it.ord).padStart(3, '0') + '</span>' +
                    '<div class="card-veil">' +
                        '<div class="card-veil-top">' + score +
                            '<span class="card-badge st-' + it.status + '">' + (STATUS[it.status] || '') + '</span>' +
                        '</div>' +
                        '<span class="card-veil-hint">查看详情</span>' +
                    '</div>' +
                '</div>' +
                '<div class="card-body">' +
                    '<div class="card-meta">' +
                        '<span class="card-date">' + it.md + '</span>' +
                        '<span class="card-season s-' + season.key + '">' + season.label + '</span>' +
                    '</div>' +
                    '<h3 class="card-title">' + esc(it.title) + '</h3>' +
                '</div>' +
            '</article>';
    }

    function gapText(era, prev) {
        if (!era.year) return '播出时间未定，还在时光里漂泊';
        if (!prev || !prev.year) return '时光的起点';
        const gap = era.year - prev.year;
        if (gap <= 1) return '紧接着上一年';
        return '与上一部相隔 ' + gap + ' 年';
    }

    function renderTimeline() {
        const host = $('#timeline');
        if (!host) return;

        if (!state.items.length) {
            host.innerHTML = '<div class="tm-empty">没有可以展示的番剧</div>';
            return;
        }

        const first = state.items[0];
        const parts = [];

        parts.push(
            '<div class="timeline-start">' +
                '<span>JOURNEY START · ' + (first.date || '未知日期') + '</span>' +
            '</div>'
        );

        state.eras.forEach((era, idx) => {
            const prev = idx > 0 ? state.eras[idx - 1] : null;
            const gap = gapText(era, prev);
            const grid = era.items.map((it) => cardHTML(it)).join('');

            parts.push(
                '<section class="era" id="y-' + era.key + '" data-key="' + era.key + '" data-idx="' + idx + '"' +
                ' aria-label="' + (era.year ? era.year + ' 年' : '时间未定') + '，共 ' + era.items.length + ' 部">' +
                    '<span class="era-node" aria-hidden="true"></span>' +
                    '<div class="era-year">' +
                        '<div class="era-year-num">' + (era.year || '????') + '</div>' +
                        '<div class="era-year-meta">' + era.items.length + ' 部 · 按播出时间</div>' +
                        '<div class="era-year-gap">' + gap + '</div>' +
                    '</div>' +
                    '<div class="era-grid">' + grid + '</div>' +
                '</section>'
            );
        });

        parts.push(
            '<div class="timeline-end">' +
                '<strong>时间线到这里暂告一段</strong>' +
                '<span>下一部会在某个还没到来的时间出现</span>' +
            '</div>'
        );

        host.innerHTML = parts.join('');
        state.eraEls = $$('.era', host);
    }

    /* ---------------- 滚动 / 激活 ---------------- */

    function scrollToEl(el, offset) {
        const top = window.scrollY + el.getBoundingClientRect().top - (offset || 80);
        window.scrollTo({ top: Math.max(0, top), behavior: state.reduced ? 'auto' : 'smooth' });
    }

    function setupReveal() {
        if (!('IntersectionObserver' in window) || state.reduced) {
            state.eraEls.forEach((el) => el.classList.add('is-in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-in');
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: '160px 0px -8% 0px', threshold: 0.01 });
        state.eraEls.forEach((el) => io.observe(el));
    }

    function updateScrollState() {
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const bar = $('#progress-bar');
        if (bar) {
            const pct = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
            bar.style.width = pct.toFixed(2) + '%';
        }

        const rail = $('#decade-rail');
        if (rail) rail.classList.toggle('visible', window.scrollY > window.innerHeight * 0.82);

        const trigger = window.innerHeight * 0.34;
        let idx = -1;
        for (let i = 0; i < state.eraEls.length; i++) {
            if (state.eraEls[i].getBoundingClientRect().top <= trigger) idx = i;
        }
        if (idx === state.activeIdx) return;

        if (state.activeIdx > -1 && state.eraEls[state.activeIdx]) {
            state.eraEls[state.activeIdx].classList.remove('is-near');
        }
        state.activeIdx = idx;
        if (idx > -1) {
            const el = state.eraEls[idx];
            el.classList.add('is-near');
            const era = state.eras[idx];
            if (era && era.year) setActiveDecade(Math.floor(era.year / 10) * 10);
        }
    }

    function setActiveDecade(decade) {
        $$('.rail-item').forEach((btn) => {
            btn.classList.toggle('active', Number(btn.dataset.decade) === decade);
        });
    }

    function onScroll() {
        if (onScroll._ticking) return;
        onScroll._ticking = true;
        requestAnimationFrame(() => {
            onScroll._ticking = false;
            updateScrollState();
        });
    }

    /* ---------------- 弹窗 ---------------- */

    function openModal(id) {
        const it = state.byId.get(String(id));
        if (!it) return;

        const modal = $('#tm-modal');
        const img = $('#tm-modal-img');
        const cover = imageUrl(it.cover);
        const mirror = mirrorUrl(it.cover);

        if (cover) {
            img.style.display = '';
            img.onerror = function () { this.onerror = null; if (mirror) this.src = mirror; };
            img.src = cover;
            img.alt = it.title + ' 封面';
        } else {
            img.style.display = 'none';
            img.removeAttribute('src');
        }

        const dateText = it.year
            ? it.year + '.' + (it.month ? pad2(it.month) : '--') + '.' + (it.day ? pad2(it.day) : '--')
            : 'DATE UNKNOWN';

        $('#tm-modal-eyebrow').textContent = dateText + '  ·  NO.' + String(it.ord).padStart(3, '0');
        $('#tm-modal-title').textContent = it.title;

        const jp = $('#tm-modal-jp');
        jp.textContent = it.jp && it.jp !== it.title ? it.jp : '';
        jp.style.display = jp.textContent ? '' : 'none';

        const stats = [
            ['评分', it.score > 0 ? it.score.toFixed(1) : '—'],
            ['集数', it.eps > 0 ? it.eps : '—'],
            ['状态', STATUS[it.status] || '—'],
            ['排名', it.rank > 0 ? '#' + it.rank : '—']
        ];
        $('#tm-modal-stats').innerHTML = stats.map((s) =>
            '<div class="tm-stat"><span>' + s[0] + '</span><b>' + esc(s[1]) + '</b></div>'
        ).join('');

        $('#tm-modal-summary').textContent = it.summary || '暂无简介。';

        const tags = it.tags.slice(0, 8);
        $('#tm-modal-tags').innerHTML = tags.map((t) => '<span>' + esc(t) + '</span>').join('');

        $('#tm-modal-link').href = bangumiUrl(it.id);

        state.lastFocus = document.activeElement;
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => $('#tm-modal-close').focus(), 60);
    }

    function closeModal() {
        const modal = $('#tm-modal');
        if (!modal || !modal.classList.contains('open')) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
    }

    /* ---------------- 事件 ---------------- */

    function setupEvents() {
        const timeline = $('#timeline');

        timeline.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if (card) openModal(card.dataset.id);
        });

        timeline.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.card');
            if (!card) return;
            e.preventDefault();
            openModal(card.dataset.id);
        });

        const modal = $('#tm-modal');
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]') || e.target.id === 'tm-modal-close') closeModal();
        });
        $('#tm-modal-close').addEventListener('click', closeModal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });

        $('#random-jump').addEventListener('click', () => {
            const pool = state.eras.filter((era, i) => i !== state.activeIdx);
            const list = pool.length ? pool : state.eras;
            const era = list[Math.floor(Math.random() * list.length)];
            const el = era && document.getElementById('y-' + era.key);
            if (el) scrollToEl(el, 88);
        });

        $('#jump-latest').addEventListener('click', () => {
            const era = state.eras.filter((e) => e.year).pop();
            const el = era && document.getElementById('y-' + era.key);
            if (el) scrollToEl(el, 88);
        });
    }

    /* ---------------- 樱花 ---------------- */

    function initPetals() {
        const canvas = $('#petals');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = 0, h = 0, dpr = 1;
        let petals = [];
        let raf = 0;
        let last = 0;

        const TINTS = [
            [255, 168, 199],
            [255, 190, 214],
            [255, 143, 184],
            [255, 214, 232],
            [188, 220, 250]
        ];

        function makePetal(seeded) {
            const r = Math.random;
            const size = 6 + r() * 7;
            return {
                x: r() * w,
                y: seeded ? r() * h : -20 - r() * 120,
                size: size,
                vy: 14 + r() * 28,
                sway: 16 + r() * 30,
                phase: r() * Math.PI * 2,
                rot: r() * Math.PI * 2,
                vr: (r() - 0.5) * 0.9,
                tint: TINTS[Math.floor(r() * TINTS.length)],
                alpha: 0.5 + r() * 0.4,
                flip: 0.4 + r() * 0.9
            };
        }

        function build() {
            const count = Math.min(34, Math.max(12, Math.round(w / 42)));
            petals = [];
            for (let i = 0; i < count; i++) petals.push(makePetal(true));
        }

        function shape(size) {
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.bezierCurveTo(size * 0.92, -size * 0.55, size * 0.72, size * 0.62, 0, size * 0.86);
            ctx.bezierCurveTo(-size * 0.72, size * 0.62, -size * 0.92, -size * 0.55, 0, -size);
            ctx.closePath();
        }

        function draw(dt, animate) {
            ctx.clearRect(0, 0, w, h);
            for (let i = 0; i < petals.length; i++) {
                const p = petals[i];
                if (animate) {
                    p.y += p.vy * dt * 0.001;
                    p.phase += dt * 0.0009;
                    p.rot += p.vr * dt * 0.001;
                    if (p.y > h + 24) { petals[i] = makePetal(false); continue; }
                }
                const x = p.x + Math.sin(p.phase) * p.sway;
                const squash = Math.abs(Math.cos(p.phase * p.flip));
                ctx.save();
                ctx.translate(x, p.y);
                ctx.rotate(p.rot);
                ctx.scale(0.55 + squash * 0.6, 1);
                ctx.fillStyle = 'rgba(' + p.tint[0] + ',' + p.tint[1] + ',' + p.tint[2] + ',' + p.alpha.toFixed(2) + ')';
                shape(p.size);
                ctx.fill();
                ctx.restore();
            }
        }

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            build();
            draw(0, false);
        }

        function loop(t) {
            const dt = last ? Math.min(48, t - last) : 16;
            last = t;
            draw(dt, true);
            raf = requestAnimationFrame(loop);
        }

        function start() {
            if (state.reduced || document.hidden) { draw(0, false); return; }
            if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
        }

        function stop() {
            if (raf) { cancelAnimationFrame(raf); raf = 0; }
        }

        resize();
        start();

        let rt = 0;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => { resize(); start(); }, 180);
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stop(); else start();
        });
    }

    /* ---------------- 启动 ---------------- */

    async function boot() {
        initPetals();

        let data = null;
        try {
            const res = await Promise.all([
                fetchJSON(CFG_URL).catch(() => ({})),
                fetchJSON(DATA_URL)
            ]);
            state.cfg = res[0] || {};
            data = res[1];
        } catch (err) {
            console.error(err);
            const host = $('#timeline');
            if (host) host.innerHTML = '<div class="tm-empty">数据加载失败，请刷新重试</div>';
            return;
        }

        applyConfig();

        const raw = (data && data.collections) || [];
        state.items = raw
            .filter((c) => c && c.subject && c.type !== 5)
            .map(normalize)
            .sort(compare);

        state.items.forEach((it, i) => {
            it.ord = i + 1;
            state.byId.set(String(it.id), it);
        });

        state.eras = buildEras(state.items);

        const range = renderHero(state.items);
        renderEraBars(state.items, range);
        renderDecadeRail();
        renderTimeline();
        setupReveal();
        setupEvents();
        updateScrollState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
