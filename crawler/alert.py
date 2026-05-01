"""텔레그램 봇으로 기사 선정 알람 전송."""
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "http://localhost:3000")


def send_alert(triggered: list[dict]):
    """임계값 초과 기사 목록을 텔레그램으로 전송."""
    if not triggered or not BOT_TOKEN or not CHAT_ID:
        if not BOT_TOKEN:
            print("  [알람 스킵] TELEGRAM_BOT_TOKEN 미설정")
        return

    asyncio.run(_send(triggered))


async def _send(triggered: list[dict]):
    from telegram import Bot
    bot = Bot(token=BOT_TOKEN)

    for item in triggered:
        article = item["article"]
        cv = item["comment_velocity"]
        lv = item["like_velocity"]

        msg = (
            f"🚨 *기사 선정 알람*\n\n"
            f"📌 {article['title']}\n\n"
            f"💬 댓글 증가: +{cv:.1f}건/시간\n"
            f"👍 좋아요 증가: +{lv:.1f}건/시간\n\n"
            f"🔗 [원문 보기]({article['url']})\n"
            f"📊 [대시보드]({DASHBOARD_URL}/articles/{article['id']})"
        )

        try:
            await bot.send_message(
                chat_id=CHAT_ID,
                text=msg,
                parse_mode="Markdown",
                disable_web_page_preview=False,
            )
            print(f"  [알람 전송] {article['title'][:30]}...")
        except Exception as e:
            print(f"  [알람 오류] {e}")
