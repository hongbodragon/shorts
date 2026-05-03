"""텔레그램 봇으로 핫 콘텐츠 알람 전송."""
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "http://localhost:3000")


def send_alert(triggered: list[dict]):
    """핫 콘텐츠 목록을 텔레그램으로 전송.

    triggered 항목 포맷:
      {"type": "community", "item": {...community_posts row...}}
      {"type": "article",   "item": {...articles row...}}
    """
    if not triggered or not BOT_TOKEN or not CHAT_ID:
        if not BOT_TOKEN:
            print("  [알람 스킵] TELEGRAM_BOT_TOKEN 미설정")
        return

    asyncio.run(_send(triggered))


async def _send(triggered: list[dict]):
    from telegram import Bot
    bot = Bot(token=BOT_TOKEN)

    for item in triggered:
        t = item["type"]
        data = item["item"]

        if t == "community":
            msg = (
                f"💬 *다모앙 핫 게시글*\n\n"
                f"📌 {data['title']}\n\n"
                f"댓글 {data['comment_cnt']}개\n\n"
                f"🔗 [게시글 보기]({data['url']})\n"
                f"📊 [대시보드]({DASHBOARD_URL})"
            )
        else:
            msg = (
                f"🔥 *밀리돔 핫 기사*\n\n"
                f"📌 {data['title']}\n\n"
                f"조회수 {data['view_cnt']:,}회\n\n"
                f"🔗 [기사 보기]({data['url']})\n"
                f"📊 [대시보드]({DASHBOARD_URL}/articles/{data['id']})"
            )

        try:
            await bot.send_message(
                chat_id=CHAT_ID,
                text=msg,
                parse_mode="Markdown",
                disable_web_page_preview=False,
            )
            print(f"  [알람 전송] {data['title'][:30]}...")
        except Exception as e:
            print(f"  [알람 오류] {e}")
