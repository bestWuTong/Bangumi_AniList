#!/usr/bin/env python3
"""Bangumi 追番数据爬取脚本 - 保存完整原始数据"""

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

# 从 config.json 读取配置
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
config_path = os.path.join(project_root, "config.json")

if os.path.exists(config_path):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    USERNAME = config.get("username", "")
    NICKNAME = config.get("nickname", "")
else:
    print("错误: 未找到 config.json 文件")
    sys.exit(1)

if not USERNAME:
    print("错误: config.json 中未配置 username")
    sys.exit(1)

USER_AGENT = "wutong/bangumi-anilist/1.0 (https://github.com/wutong/Bangumi_AniList)"


def create_session():
    session = requests.Session()
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504, 429])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    return session


def get_headers():
    return {"User-Agent": USER_AGENT, "Accept": "application/json"}


def fetch_collections(session):
    """获取所有收藏的完整原始数据"""
    all_collections = []
    offset = 0
    limit = 50
    total = None

    while True:
        limit_str = f"{min(offset + limit, total)}" if total else "?"
        print(f"正在获取第 {offset + 1}-{limit_str} 条...")
        try:
            resp = session.get(
                f"{BANGUMI_API}/v0/users/{USERNAME}/collections",
                params={"subject_type": 2, "limit": limit, "offset": offset},
                headers=get_headers(),
                timeout=30,
            )
            if resp.status_code == 404:
                print(f"用户 {USERNAME} 不存在")
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

            time.sleep(1)
        except Exception as e:
            print(f"请求失败: {e}")
            time.sleep(3)

    return all_collections


def main():
    print("=" * 50)
    print("Bangumi 追番数据爬取")
    print("=" * 50)
    print(f"用户: {USERNAME} ({NICKNAME})")

    session = create_session()

    collections = fetch_collections(session)
    if not collections:
        print("获取收藏失败")
        sys.exit(1)

    print(f"\n共获取 {len(collections)} 条收藏")

    output = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "username": USERNAME,
        "nickname": NICKNAME,
        "total": len(collections),
        "collections": collections,
    }

    output_path = os.path.join(project_root, "bangumi.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n数据已保存到: {output_path}")
    print("完成!")


if __name__ == "__main__":
    main()
