#!/usr/bin/env python3
"""Bangumi 追番数据爬取脚本"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 配置
BANGUMI_API = "https://api.bgm.tv"

# 从 config.json 读取用户ID
script_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(os.path.dirname(script_dir), "config.json")

if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    USER_ID = config.get("user_id")
else:
    print("错误: 未找到 config.json 文件")
    print("请创建 config.json 并添加 user_id 字段")
    sys.exit(1)

if not USER_ID:
    print("错误: config.json 中未配置 user_id")
    sys.exit(1)

USER_AGENT = f"bangumi-anilist/1.0 (https://github.com/user/Bangumi_AniList)"

# 追番状态映射
STATUS_MAP = {
    1: "想看",
    2: "看过",
    3: "在看",
    4: "搁置",
    5: "抛弃",
}

# 番剧类型映射
SUBJECT_TYPE_MAP = {
    1: "书籍",
    2: "动画",
    3: "音乐",
    4: "游戏",
    6: "实际",
}


def create_session():
    """创建带重试机制的会话"""
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[500, 502, 503, 504, 429],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def get_headers():
    """获取请求头"""
    return {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }


def fetch_user_info(session):
    """获取用户信息，确认用户名"""
    try:
        resp = session.get(
            f"{BANGUMI_API}/user/{USER_ID}",
            headers=get_headers(),
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("username", "")
    except Exception as e:
        print(f"获取用户信息失败: {e}")
    return ""


def fetch_collections_v0(session, username):
    """使用新API获取用户的所有动画收藏"""
    all_collections = []
    offset = 0
    limit = 50
    total = None

    while True:
        print(f"正在获取第 {offset + 1}-{offset + limit} 条...")
        try:
            resp = session.get(
                f"{BANGUMI_API}/v0/users/{username}/collections",
                params={
                    "subject_type": 2,  # 动画
                    "limit": limit,
                    "offset": offset,
                },
                headers=get_headers(),
                timeout=30,
            )

            if resp.status_code == 404:
                print(f"用户 {username} 不存在")
                return None

            resp.raise_for_status()
            data = resp.json()

            if total is None:
                total = data.get("total", 0)
                print(f"总共 {total} 条记录")

            items = data.get("data", [])
            if not items:
                break

            all_collections.extend(items)
            offset += limit

            if offset >= total:
                break

            # 避免请求过快
            time.sleep(1)
        except Exception as e:
            print(f"请求失败: {e}")
            time.sleep(3)
            continue

    return all_collections


def fetch_subject_detail(session, subject_id):
    """获取条目详细信息（包含infobox）"""
    for attempt in range(3):
        try:
            resp = session.get(
                f"{BANGUMI_API}/v0/subjects/{subject_id}",
                headers=get_headers(),
                timeout=30,
            )

            if resp.status_code == 404:
                print(f"条目 {subject_id} 不存在，跳过")
                return None

            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"获取条目 {subject_id} 失败 (尝试 {attempt + 1}/3): {e}")
            time.sleep(2)

    return None


def extract_anime_type(infobox):
    """从infobox中提取动画类型（TV/剧场版/OVA等）"""
    if not infobox:
        return "TV"

    for item in infobox:
        key = item.get("key", "")
        value = item.get("value", "")

        # 常见的类型字段名
        if key in ("动画", "Anime", "anime"):
            if isinstance(value, dict):
                return value.get("v", "TV")
            elif isinstance(value, list):
                return value[0].get("v", "TV") if value else "TV"
            elif isinstance(value, str):
                return value
            break

        # 检查 infobox 是否包含类型信息
        value_str = str(value)
        if "剧场版" in value_str:
            return "剧场版"
        if "OVA" in value_str.upper():
            return "OVA"
        if "TV" in value_str:
            return "TV"
        if "Web" in value_str or "网络" in value_str:
            return "Web"

    return "TV"


def process_collection(session, collection, need_detail=True):
    """处理单条收藏数据"""
    subject = collection.get("subject", {})
    subject_id = subject.get("id")

    # 基础信息
    anime = {
        "id": subject_id,
        "name": subject.get("name", ""),
        "name_cn": subject.get("name_cn", ""),
        "cover": "",
        "eps_watched": collection.get("ep_status", 0),
        "eps_total": subject.get("eps", 0),
        "status": STATUS_MAP.get(collection.get("type", 0), "未知"),
        "status_id": collection.get("type", 0),
        "type": SUBJECT_TYPE_MAP.get(subject.get("type", 2), "动画"),
        "air_date": subject.get("date", ""),
        "summary": subject.get("short_summary", ""),
        "score": subject.get("score", 0),
        "tags": [t.get("name", "") for t in subject.get("tags", [])[:5]],
    }

    # 封面图
    images = subject.get("images", {})
    if images:
        anime["cover"] = images.get("large") or images.get("common") or images.get("medium", "")

    # 获取详细信息
    if need_detail and subject_id:
        time.sleep(0.5)  # 避免请求过快
        detail = fetch_subject_detail(session, subject_id)
        if detail:
            anime["summary"] = detail.get("summary", anime["summary"])
            anime["type"] = extract_anime_type(detail.get("infobox", []))
            # 更新封面
            detail_images = detail.get("images", {})
            if detail_images:
                anime["cover"] = detail_images.get("large") or detail_images.get("common") or anime["cover"]

    return anime


def main():
    """主函数"""
    print("=" * 50)
    print("Bangumi 追番数据爬取")
    print("=" * 50)

    session = create_session()

    # 先尝试获取用户名
    username = fetch_user_info(session)
    if username:
        print(f"用户名: {username}")
    else:
        username = str(USER_ID)
        print(f"使用用户ID: {username}")

    # 获取收藏列表
    collections = fetch_collections_v0(session, username)

    if not collections:
        print("获取收藏失败")
        sys.exit(1)

    print(f"\n共获取 {len(collections)} 条收藏")

    # 处理数据
    anime_list = []
    for i, collection in enumerate(collections):
        print(f"处理第 {i + 1}/{len(collections)} 条...")
        anime = process_collection(session, collection, need_detail=True)
        anime_list.append(anime)

    # 按状态分组统计
    status_count = {}
    for anime in anime_list:
        status = anime["status"]
        status_count[status] = status_count.get(status, 0) + 1
    print("\n统计:")
    for status, count in status_count.items():
        print(f"  {status}: {count} 部")

    # 保存数据
    output = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "user": username,
        "total": len(anime_list),
        "anime_list": anime_list,
    }

    # 确定输出路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_path = os.path.join(project_root, "bangumi.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n数据已保存到: {output_path}")
    print("完成!")


if __name__ == "__main__":
    main()
