# Bangumi 追番列表

一个自动同步 Bangumi 追番数据的网站，部署在 GitHub Pages 上

## 功能

- 每天自动从 Bangumi API 爬取追番数据
- 番剧列表按状态筛选（全部/在看/看过/想看/搁置），显示数量统计
- 点击番剧弹出详情弹窗，显示封面、名称、评分、集数、标签、简介
- 支持番剧搜索
- 番剧封面可选显示/隐藏
- 支持自定义背景图、头像、网站图标
- 支持 Bangumi 镜像站和图片镜像源
- 毛玻璃风格 UI，圆角卡片，非线性动画
- 响应式设计，移动端自适应

## 项目结构

```
Bangumi_AniList/
├── .github/workflows/
│   ├── update-bangumi.yml      # 定时爬取数据的工作流
│   └── static.yml              # 部署到 GitHub Pages 的工作流
├── scripts/
│   ├── fetch_bangumi.py        # Python 爬虫脚本
│   └── requirements.txt        # Python 依赖
├── static/
│   ├── style.css               # 页面样式
│   └── script.js               # 前端逻辑
├── index.html                  # 主页面
├── config.json                 # 网站配置
├── bangumi.json                # 爬取的追番数据
└── README.md                   # 项目说明
```

## 配置说明

编辑 `config.json` 文件

### 配置项说明

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `username` | string | 是 | Bangumi 用户名（用于查询数据） |
| `nickname` | string | 是 | 网站显示的昵称 |
| `avatar` | string | 否 | 用户头像 URL，为空则不显示头像 |
| `website` | string | 否 | 用户个人网站 URL，为空则不能点击头像跳转网页 |
| `background` | string | 否 | 桌面端（横屏）背景图 URL |
| `background_mobile` | string | 否 | 移动端（竖屏）背景图 URL |
| `favicon` | string | 否 | 网站图标 URL |
| `bangumi_mirror` | string | 否 | Bangumi 镜像站地址，为空则使用 `https://bgm.tv/` |
| `bangumi_image_mirror` | string | 否 | 图片镜像站地址，为空则使用 `https://lain.bgm.tv/` |
| `show_cover` | boolean | 否 | 是否显示番剧封面图，默认 `true` （当番剧封面加载缓慢时可关闭该选项以改善用户体验）|

## 云端部署

1. Fork 本仓库到你的 GitHub
2. 修改 config.json 配置文件
3. 进入仓库 → Settings → Pages，Source 选择 GitHub Actions
4. 先手动爬取一次数据 Actions → Update Bangumi Data → Run workflow
5. 等待 Action 运行完成（首次约 1-2 分钟）
6. 访问 `https://<你的用户名>.github.io/Bangumi_AniList/`

### 修改自动爬取时间

编辑 `.github/workflows/update-bangumi.yml` 中的 cron 表达式：

```yaml
on:
  schedule:
    - cron: '0 20 * * *'  # UTC 时间
```

cron 格式为 `分 时 日 月 周`，**使用 UTC 时间**。

**常用时间对照（UTC = 北京时间 - 8 小时）：**

| 北京时间 | UTC 时间 | cron 表达式 |
|----------|----------|-------------|
| 00:00 | 16:00 (前一日) | `0 16 * * *` |
| 04:00 | 20:00 (前一日) | `0 20 * * *` |
| 08:00 | 00:00 | `0 0 * * *` |
| 12:00 | 04:00 | `0 4 * * *` |
| 18:00 | 10:00 | `0 10 * * *` |
| 23:00 | 15:00 | `0 15 * * *` |

修改后提交即可生效。也可以在 Actions 页面手动点击 **Run workflow** 立即触发。

## 本地运行

下载源码、修改 config.json 配置文件，安装 Python 然后运行：

```bash
# 安装依赖
pip install -r scripts/requirements.txt

# 运行爬虫获取数据
python scripts/fetch_bangumi.py

# 启动本地服务器
python -m http.server 8000
```

访问 http://localhost:8000

## 技术栈

- **爬虫**: Python + requests（调用 Bangumi API v0）
- **前端**: 纯 HTML/CSS/JS
- **部署**: GitHub Actions + GitHub Pages
