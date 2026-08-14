# Bangumi 追番列表

一个能自动同步 Bangumi 个人追番数据的网站，部署在 GitHub Pages 上

## 查看示例
[https://ani.bestwutong.top/](https://ani.bestwutong.top/)


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
│   ├── covers/                 # 爬取的番剧封面（可选）
│   ├── style.css               # 页面样式
│   └── script.js               # 前端逻辑
├── index.html                  # 主页面
├── config.json                 # 网站配置
├── bangumi.json                # 爬取的追番数据
└── README.md                   # 项目说明
```

## 配置说明

编辑 `config.json` 文件

```json
{
  "scripts": {
    "username": "wutong",
    "fetch_covers": true
  },
  "anilist": {
    "nickname": "無同",
    "avatar": "",
    "website": "",
    "background": "",
    "background_mobile": "",
    "favicon": "",
    "bangumi_mirror": "",
    "bangumi_image_mirror": "",
    "show_covers": true,
    "use_fetched_covers": false
  }
}
```

### `scripts` 段

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `username` | string | 是 | Bangumi 用户名（用于查询数据） |
| `fetch_covers` | boolean | 否 | 是否将番剧封面下载到仓库 `static/covers/` |

### `anilist` 段

| 配置项 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `nickname` | string | 是 | 网站显示的昵称 |
| `avatar` | string | 否 | 用户头像 URL，为空则不显示头像 |
| `website` | string | 否 | 用户个人网站 URL，为空则不能点击头像跳转网页 |
| `background` | string | 否 | 桌面端（横屏）背景图 URL |
| `background_mobile` | string | 否 | 移动端（竖屏）背景图 URL |
| `favicon` | string | 否 | 网站图标 URL |
| `bangumi_mirror` | string | 否 | Bangumi 网站镜像地址，用于跳转个人主页和番剧详情页，为空则使用 `https://bgm.tv/` |
| `bangumi_image_mirror` | string | 否 | 番剧封面图片镜像地址，为空则使用原地址 `https://lain.bgm.tv/` 显示封面（仅用于显示，不用于爬取） |
| `show_covers` | boolean | 否 | 是否显示番剧封面图，默认 `true`（当封面加载缓慢时可关闭该选项以改善用户体验） |
| `use_fetched_covers` | boolean | 否 | 是否使用仓库中已爬取的封面。`true` 时优先显示 `static/covers/` 里的本地封面（加载失败会回退到镜像/原地址），`false` 时使用 `bangumi_image_mirror` 地址显示 |

注意： `string` 类型的参数为空值时这样表示： `""`

如何获取 `username` ？ 登录 [https://bgm.tv/](https://bgm.tv/) -> 查看个人主页 -> 复制浏览器地址栏中最后一个字段，如 [https://bgm.tv/user/wutong](https://bgm.tv/user/wutong) 中的 `wutong`

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
    - cron: '0 3 * * *'
      timezone: 'Asia/Shanghai'
```

cron 格式为 `分 时 日 月 周`，当前为每天 03:00 运行。

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
