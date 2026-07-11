# Bangumi 追番列表

一个自动同步 Bangumi 追番数据的静态网站，部署在 GitHub Pages 上。

## 功能

- 每天自动从 Bangumi 爬取追番数据
- 按状态筛选：在看、看过、想看、搁置
- 支持搜索番剧
- 显示番剧标签、简介、进度、开播时间等信息
- 响应式设计，支持移动端

## 项目结构

```
Bangumi_AniList/
├── .github/workflows/
│   └── update-bangumi.yml      # GitHub Actions 工作流，每天自动爬取数据
├── scripts/
│   ├── fetch_bangumi.py        # Python 爬虫脚本
│   └── requirements.txt        # Python 依赖
├── static/
│   ├── style.css               # 页面样式，响应式设计
│   └── script.js               # 前端逻辑，加载数据并渲染番剧列表
├── index.html                  # 主页面
├── bangumi.json                # 爬取的追番数据（自动生成）
├── config.json                 # 配置文件（用户ID、昵称）
├── README.md                   # 项目说明
└── .gitignore                  # Git 忽略文件
```

### 文件说明

| 文件 | 说明 |
|------|------|
| `config.json` | 配置文件，包含 Bangumi 用户 ID 和显示昵称 |
| `bangumi.json` | 爬取的追番数据，由 GitHub Actions 每天自动更新 |
| `index.html` | 网站主页面 |
| `static/style.css` | 页面样式，响应式设计 |
| `static/script.js` | 前端逻辑，加载数据并渲染番剧列表 |
| `scripts/fetch_bangumi.py` | Python 爬虫，从 Bangumi API 获取追番数据 |
| `update-bangumi.yml` | GitHub Actions 工作流，自动化爬取和部署 |

## 部署

1. Fork 本仓库
2. 进入仓库 Settings → Pages
3. Source 选择 "GitHub Actions"
4. 等待 Action 运行完成即可访问

## 本地运行

```bash
# 安装依赖
pip install -r scripts/requirements.txt

# 运行爬虫
python scripts/fetch_bangumi.py

# 启动本地服务器
python -m http.server 8000
```

然后访问 http://localhost:8000

## 自定义

修改项目根目录下的 `config.json` 文件：

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `user_id` | number | 必填 | Bangumi 用户 ID（数字） |
| `nickname` | string | 用户ID | 网站上显示的昵称 |
| `show_cover` | boolean | false | 是否显示番剧封面图 |
| `show_name_cn` | boolean | true | 是否优先显示中文名（false则显示日文名） |
| `show_type` | boolean | true | 是否显示番剧类型（TV/剧场版等） |
| `show_status` | boolean | true | 是否显示追番状态（在看/看过/想看等） |
| `show_progress` | boolean | true | 是否显示观看进度和进度条 |
| `show_air_date` | boolean | true | 是否显示开播时间 |
| `show_summary` | boolean | true | 是否显示番剧简介 |
| `show_score` | boolean | true | 是否显示评分 |
| `show_tags` | boolean | true | 是否显示番剧标签 |

## 技术栈

- **爬虫**: Python + requests
- **前端**: 纯 HTML/CSS/JS
- **部署**: GitHub Actions + GitHub Pages
